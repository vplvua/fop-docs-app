## Context

For `service_type = access`, classification today resolves `unit_price` via the tariff resolver and then `resolveAccessQuantity(amount, unitPrice)` returns `quantity = amount / unitPrice` in months, requiring exact divisibility (`lib/classification/resolve-quantity.ts`). The whole model assumes **months = money ÷ monthly price**. The yearly discount breaks that 1:1 relation: 2000 грн buys 12 months but `2000 / 200 = 10`. With no special case, a 2000 грн payment currently classifies as a clean 10-month act — wrong, and silent.

The act is a per-payment snapshot. The PDF (`lib/pdf/act-template.tsx`) prints a service line `{service_description}, {quantity} шт. – {total} грн.` where `total = unitPrice × quantity`, and the quantity unit is hard-coded `шт.`. The client sample `act-2026-04_2000.pdf` shows the target: `… (один календарний місяць), 12 шт. – 2000.00 грн.` — `12 × unit_price` cannot equal `2000.00` for any 2-decimal unit price, so the total must be the actual payment amount.

Reused infrastructure: the key-value `settings` store with `getSettingValue`/`setSettingValue` and the code-default accessor pattern (`getServiceNames`, polling intervals); the settings-page pattern (`page.tsx` + `actions.ts` + `action-state.ts` + form). Constraints: `lib/` stays pure; `npm run qa` (D-037) must pass; dev/prod are separate Neon branches (`docs/operations.md`).

## Goals / Non-Goals

**Goals:**

- Recognise a one-shot yearly payment (`amount == unit_price × N`, `N = annual_paid_months`, default 10) as a full year: `quantity = 12`, `billing_period = annual`.
- Annual act renders the exact paid total with the same service name and `шт.` unit (matches the client sample).
- Admin configures `N` from the Тарифи page; default 10 preserves "pay 10, get 12".
- Fix the latent 10-month miscount of yearly payments.

**Non-Goals:**

- No multi-year payments, no per-client/time-effective discount, no separate annual service name or unit.
- No backfill/reclassification of historical payments (none exist).
- Override clients get **no** yearly discount — explicitly excluded, not merely unhandled.

## Decisions

### D1: Global discount as `annual_paid_months` (default 10), not a per-row annual price

The examples are uniform — a year always costs 10 monthly prices (200→2000, 300→3000, 400→4000). One integer `N` in `settings` (key `annual_paid_months`, accessor `getAnnualPaidMonths()` returning stored `?? 10`) derives every annual price as `unit_price × N`, including for future apartment-count tariffs, with no per-row data to maintain. Not seeded — the code default (mirroring `service_names`) keeps behaviour identical until configured. Editable on the Тарифи page (the access price lives there). Alternative (an `annual_price` column per tariff row) rejected: more data to keep in sync for a value that is always `monthly × 10`; a single knob is enough and applies uniformly. Trade-off: the annual price cannot diverge from `monthly × N` (e.g. 1900) — acceptable per current pricing.

### D2: Annual match takes precedence; override clients are excluded

For `access`, let `annual = unit_price × N`. Order:

1. If client has **no** `access_price_override` **and** `amount == annual` → annual (`quantity = 12`, `billing_period = annual`).
2. Else if `amount % unit_price == 0` and (`access_price_override` is set **or** `amount / unit_price < N`) → monthly (`quantity = amount / unit_price`).
3. Else → `in_queue(amount_mismatch)`.

Annual is checked first so `2000` is credited as a year, not 10 months. The monthly path is capped below the annual price for non-override clients (so 2200/2400 → review, not 11/12 silent months — conservative per the agreed scope). Override clients skip the annual rule entirely and keep today's unbounded monthly behaviour: a 2000 грн payment at a 200 грн override = 10 months, no free months. The discount is intentionally **not** extended to negotiated prices.

### D3: Act total comes from a stored `amount`, not `unit_price × quantity`

`12 × unit_price ≠ 2000` for any 2-decimal unit price, so the annual total cannot be a product. Add `acts.amount` (numeric, NOT NULL) = the payment amount, and render it as `{total}` in the PDF and the total-in-words line. For monthly acts `amount == unit_price × quantity`, so they render identically; existing rows are backfilled `amount = unit_price × quantity` in the migration. `unit_price` on an annual act stays the **catalog monthly price** (e.g. 200) — a clean tariff value; it is never printed, so the implicit `2000/12` is never shown and no rounding artifact appears on the document. `quantity_unit` stays `шт.` and the service name is unchanged. Alternative (store `unit_price = amount/12 = 166.67`) rejected: produces `166.67 × 12 = 2000.04`, an ugly artifact that matches no tariff row.

### D4: `billing_period` column for analytics

Add `acts.billing_period` (`monthly` | `annual`, default `monthly`). It does not affect rendering — `amount`/`quantity` fully determine the PDF — but lets the admin later count/search annual prepayments without re-deriving from amounts. Existing rows backfill to `monthly`.

## Risks / Trade-offs

- **`unit_price × quantity` no longer equals the printed total for annual acts** → every consumer that recomputes a total by multiplying would be wrong. Audited consumers, all switched to `act.amount`: PDF (`lib/pdf/act-template.tsx`), acts table (`acts/page.tsx`), act detail (`acts/[id]/page.tsx`), client detail (`clients/[id]/client-related.tsx`). **Critically — not just UI**: `lib/external-apis/dubidoc/mapper.ts` builds the EDO payload `amount = round(unit_price × quantity)`; for an annual act that is `round(200 × 12) = 2400`, so the document submitted to Dubidoc for signing would carry the wrong total. It must read `act.amount` too.

### D5: Fix the DubiDoc amount units (kopiykas) — pre-existing bug surfaced here

Empirically, DubiDoc interprets the payload `amount` in **kopiykas**: an act for 1624.00 грн currently shows `16.24`, a 200.00 грн act shows `2` (the mapper sends hryvnias). This is a pre-existing defect affecting **every** act sent today, independent of the annual feature — but it lives on the same line we are changing, so it is fixed together: `amount = round(act.amount × 100)`. The `edo-dubidoc` spec requirement (which said "integer, total = unit_price × quantity") is corrected to specify kopiykas from `act.amount`. Because it is live and standalone, it can also be hot-fixed ahead of this change (one line: `round(unit_price × quantity × 100)`) if a release is needed before the `amount` column lands.

- **Monthly cap changes behaviour for non-override clients** → amounts above the annual price that are clean multiples (2200, 2400) now route to review instead of silent N-month acts. Intended (rare, safer); documented.
- **Discount fixed at `monthly × N`** → cannot model a non-multiple annual price. Accepted (D1).
- **Migration NOT NULL on `amount`** → must backfill existing rows in the same migration before the constraint; dev and prod migrated separately (Neon branches).

## Migration Plan

1. Add `acts.amount` (nullable), backfill `amount = unit_price × quantity` for all rows, then set NOT NULL; add `acts.billing_period` enum default `monthly`.
2. Ship accessor + classification branch + PDF change + Тарифи editor.
3. `npm run db:migrate` (dev); migrate prod Neon branch separately per `docs/operations.md`.
4. Deploy. New yearly payments classify as 12-month annual acts; monthly acts unchanged.

Rollback: revert the deploy; `annual_paid_months` is additive and ignored by reverted code. The `amount`/`billing_period` columns are harmless if unused (reverted PDF recomputes `unit_price × quantity`, identical for all monthly acts).

## 1. Discount setting accessor (lib)

- [x] 1.1 Add `getAnnualPaidMonths(): Promise<number>` to `lib/settings/index.ts` — reads key `annual_paid_months` via `getSettingValue<number>`, returns `?? 10` (code default, mirroring polling-interval accessors; no seed)
- [x] 1.2 Add unit test asserting default 10 when unset and the stored value when set

## 2. Annual recognition in quantity resolution (lib, pure)

- [x] 2.1 Extend `resolveAccessQuantity` in `lib/classification/resolve-quantity.ts` to take `{ annualPaidMonths: number; hasOverride: boolean }`; implement D2 order: annual (`amount == unit_price × N`, non-override) → `quantity "12"`, `billingPeriod "annual"`; monthly (`amount % unit_price == 0` and (`hasOverride` or `amount/unit_price < N`)) → `quantity = amount/unit_price`, `billingPeriod "monthly"`; else `mismatch (amount_mismatch)`. Keep `quantity_unit "міс."` for both
- [x] 2.2 Extend the `QuantityResult` ok-shape with `billingPeriod: "monthly" | "annual"`; `resolveQuantity` returns `"monthly"` for sms
- [x] 2.3 Unit tests `tests/unit/classification/resolve-quantity.test.ts`: monthly 600/200→3; annual 2000/200 (N=10, no override)→12/annual with precedence over "10 months"; above-annual 2400/200→mismatch; override 2000/200→10/monthly (no annual); non-divisible 550/200→mismatch; N configurable (e.g. N=11)

## 3. Thread amount + billing_period through classification (lib)

- [x] 3.1 `lib/classification/types.ts` — add `amount` and `billingPeriod` to `ActStubData` and the `classified` `ClassificationResult`
- [x] 3.2 `lib/classification/classify.ts` — pass `annualPaidMonths` + `hasOverride` into `resolveAccessQuantity`; set act stub `amount = payment.amount`, `billingPeriod` from the result; keep `unit_price` = resolved catalog price
- [x] 3.3 `lib/classification/act-stub.ts` — `buildActStub` carries `amount` and `billingPeriod` onto the stub
- [x] 3.4 `lib/classification/run-classification.ts` — fetch `getAnnualPaidMonths()` in the existing `Promise.all`; thread into `classify`; write `amount` + `billing_period` to the `acts` row (and to the payment if it stores them)
- [x] 3.5 Update `tests/unit/classification/*` (act-stub, classify) for the new fields

## 4. Acts schema migration

- [x] 4.1 Add `amount` (numeric 10,2) and `billingPeriod` (pgEnum `billing_period` `['monthly','annual']`, default `monthly`) to `lib/db/schema/acts.ts`
- [x] 4.2 Generate migration; in it backfill `amount = unit_price * quantity` and `billing_period = 'monthly'` for existing rows, then set `amount` NOT NULL
- [x] 4.3 `npm run db:migrate` (dev). Prod Neon branch migrated separately per `docs/operations.md` (note in PR)

## 5. PDF renders the stored amount

- [x] 5.1 `lib/pdf/act-template.tsx` — `total` reads `act.amount` (not `unit_price × quantity`); service line and total-in-words use it; quantity still rendered as integer with `шт.`
- [x] 5.2 Verify monthly acts render identically (amount == unit_price × quantity) and an annual act renders `… , 12 шт. – 2000.00 грн.` matching `docs/samples/acts/act-2026-04_2000.pdf`
- [x] 5.3 Point UI total displays at `act.amount` instead of `unit_price × quantity`: `app/(dashboard)/acts/page.tsx:133` (acts table «Сума» column) and `app/(dashboard)/acts/[id]/page.tsx:39` (act detail «Сума» field)
- [x] 5.4 Fix `app/(dashboard)/clients/[id]/client-related.tsx:87` — the «Сума» column currently shows only `a.unitPrice` (already wrong for multi-month acts); render `act.amount`

## 5b. EDO (Dubidoc) payload amount — two bugs in one line (correctness, not UI)

`lib/external-apis/dubidoc/mapper.ts:12` currently sends `amount = Math.round(unitPrice × quantity)`. Two defects:

- **Wrong units (pre-existing, hits every act today):** Dubidoc expects the amount in **kopiykas** (integer minor units), but we send hryvnias. Confirmed empirically — an act for 1624.00 грн shows as `16.24` in Dubidoc, a 200.00 грн act shows as `2`. The value must be `× 100`.
- **Wrong source (this change):** for an annual act `unitPrice × quantity = 200 × 12 = 2400`, not the paid `2000`. Must read `act.amount`.

- [x] 5b.1 Change the payload to `amount = Math.round(Number(act.amount) * 100)` (kopiykas, from the stored real total). Add a code comment that Dubidoc's `amount` is in kopiykas
- [x] 5b.2 Confirm the `CreateDocumentRequest.amount` unit in `lib/external-apis/dubidoc/types.ts` (annotate it as kopiykas)
- [x] 5b.3 Update `tests/unit/external-apis/dubidoc/mapper.test.ts`: assert `amount` is kopiykas of `act.amount` — `200.00 → 20000`, `1624.00 → 162400`, and an annual case `amount = 2000.00 → 200000` (NOT `2400`)

## 6. Settings UI — Тарифи (annual_paid_months)

- [x] 6.1 Add an "Оплачених місяців за рік (річний платіж)" editor to `app/(settings)/settings/tariffs/` (form + server action + action-state), reading `getAnnualPaidMonths()` and saving via `setSettingValue('annual_paid_months', n)`; validate positive integer; follow the existing settings pattern and DESIGN.md tokens
- [x] 6.2 Render the editor section on `tariffs/page.tsx`, with a hint that the yearly price = monthly × this number and does not apply to clients with an individual price

## 7. Docs & quality gate

- [x] 7.1 Note the annual-discount setting and the prod migration step in `docs/operations.md`
- [x] 7.2 Run `npm run qa` and fix any failures
- [x] 7.3 Capture "Real behavior proof" — a 2000 грн payment (200 tariff, no override) classifies as a 12-month annual act and its PDF shows `12 шт. – 2000.00 грн.` (screenshot or verification log); confirm an override client paying 2000 stays 10 monthly

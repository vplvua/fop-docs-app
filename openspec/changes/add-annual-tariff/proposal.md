## Why

A client can prepay a full year in one payment at a discount: 2000 грн is credited as 12 months (not 10), 3000 грн and 4000 грн likewise for the upcoming apartment-count tariffs. The discount is uniform across the grid — **a year costs 10 monthly prices** (2 months free).

The current classifier has no notion of this. For `service_type = access` it derives `quantity = amount / unit_price` (`lib/classification/resolve-quantity.ts`). So a 2000 грн payment at a 200 грн tariff **silently produces an act for 10 months** — the divisibility check passes and nobody is alerted. This change makes a one-shot yearly payment be recognised as a full year and fixes that latent miscount.

The client's own sample act (`docs/samples/acts/act-2026-04_2000.pdf`) already shows the target shape: `Надання доступу до сервісу "Моє ОСББ" (один календарний місяць), 12 шт. – 2000.00 грн.` — quantity **12**, total **2000.00**. Since `12 × unit_price ≠ 2000` exactly, the act total must come from the actual payment amount, not `unit_price × quantity`.

## What Changes

- **New setting `annual_paid_months`** (integer, default **10**), editable on the Тарифи page next to the tariff grid. The annual price for any access tariff is `unit_price × annual_paid_months`. No new table — reuses the key-value `settings` store and the code-default pattern (`getAnnualPaidMonths()`), so behaviour is unchanged until configured.
- **Annual recognition in classification** (`access` only). With `N = annual_paid_months`:
  - client has **no** `access_price_override` **and** `amount == unit_price × N` → **annual**: `quantity = 12`, `billing_period = annual`. This branch takes **precedence** over the "10 months" reading of the same amount.
  - `amount` is a clean multiple of `unit_price` **below** the annual price (or any multiple for override clients) → **monthly**: `quantity = amount / unit_price`.
  - otherwise → `in_queue(amount_mismatch)` (e.g. 2400, two-year sums — left for human review).
- **Override clients are excluded** from the ×N rule entirely: a client with `access_price_override` is never auto-credited a yearly discount (monthly logic only, exactly as today).
- **Act total decoupled from `unit_price × quantity`.** New `acts.amount` column = the payment amount; the PDF and total-in-words line render `amount`. For monthly acts `amount == unit_price × quantity`, so they are unchanged.
- **New `acts.billing_period` column** (`monthly` | `annual`, default `monthly`) — for analytics/search; does not affect rendering.
- The annual act keeps the **same service name** and the **`шт.` unit** — only `quantity = 12` and `amount = 2000` differ from a monthly act.

## Capabilities

### New Capabilities

<!-- none -->

### Modified Capabilities

- `settings`: new requirement — admin configures the annual prepay discount (`annual_paid_months`, default 10) on the Тарифи page.
- `classification`: access price/quantity validation recognises a yearly one-shot payment (`amount == unit_price × N` → 12 months), excluding override clients; the act stub and acts table gain `amount` and `billing_period`.
- `acts`: the PDF total renders the stored `amount` (actual payment) instead of `unit_price × quantity`, so a 12-шт annual act shows the exact paid total.
- `edo-dubidoc`: the DubiDoc payload `amount` is sent in **kopiykas** from `act.amount` (`round(amount × 100)`), fixing a pre-existing 100×-too-small bug and routing annual acts through the correct total.

## Impact

- **Code**: `lib/settings/index.ts` (`getAnnualPaidMonths()`); `lib/classification/resolve-quantity.ts` (annual branch + override/`N` params, returns `billingPeriod`); `lib/classification/classify.ts`, `types.ts`, `run-classification.ts` (thread `N`, `amount`, `billing_period`); `lib/classification/act-stub.ts` (carry `amount`, `billingPeriod`); `lib/pdf/act-template.tsx` (`total` from `act.amount`); `lib/external-apis/dubidoc/mapper.ts` (`amount` = kopiykas of `act.amount`); act total displays in `app/(dashboard)/acts/page.tsx`, `acts/[id]/page.tsx`, `clients/[id]/client-related.tsx`.
- **UI**: an "Оплачених місяців за рік" editor on `app/(settings)/settings/tariffs/` (form + server action + action-state), following the existing settings pattern and DESIGN.md tokens.
- **Data**: migration adds `acts.amount` (numeric, NOT NULL — backfill existing rows = `unit_price × quantity`) and `acts.billing_period` (enum, default `monthly`). New `settings` key `annual_paid_months` (code-default 10, not seeded). Dev and prod are **separate Neon branches** — migrate prod separately (`docs/operations.md`).
- **Constraints**: `lib/` stays pure (no Next imports); `npm run qa` (D-037) must pass.
- **Out of scope**: no backfill/reclassification of past payments (none exist yet); no multi-year payments; no per-client or time-effective discount (single global `N`).

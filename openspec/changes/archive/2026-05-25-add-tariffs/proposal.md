## Why

Clients (S2) and contracts (S3) exist. The classifier (S7) needs a price resolver to calculate `unit_price` and `quantity` for acts. Without tariffs, the system cannot determine how much to charge per payment. Tariffs are the next dependency in the pipeline (S4 → S6 → S7) and also provide the UI for `/settings/tariffs` and `/settings/sms-prices`.

## What Changes

- New `tariffs` table — ranged access-price rules with `apartments_min`, `apartments_max` (NULL = catch-all), `price`, `effective_from`. UNIQUE on `(apartments_min, apartments_max, effective_from)`.
- New `sms_prices` table — SMS price history with `price`, `effective_from`. UNIQUE on `effective_from`.
- Domain functions: `resolveAccessPrice(client, paymentDate)` and `resolveSmsPrice(paymentDate)` in `lib/tariffs/`.
- Catch-all invariant: deletion of the last catch-all tariff is blocked at the domain layer.
- Price resolution priority: client override → ranged rule (narrowest first) → catch-all, each versioned by `effective_from ≤ paymentDate`.
- Seed data: 1 catch-all tariff `price=200`, 1 SMS price `price=1.40, effective_from=2024-01-01`.
- UI: `/settings/tariffs` (CRUD tariff grid) and `/settings/sms-prices` (CRUD SMS price list).
- Navigation: "Налаштування" link in top-bar leading to settings area.

## Capabilities

### New Capabilities

- `tariffs`: Tariff grid CRUD, SMS price CRUD, price resolver functions. Covers FR-TAR-01 through FR-TAR-10, FR-SET-01, FR-SET-02.

### Modified Capabilities

_(none — no existing spec requirements change)_

## Impact

- **DB:** new migrations for `tariffs` and `sms_prices` tables + seed data.
- **Schema:** new `lib/db/schema/tariffs.ts` exporting Drizzle tables + types.
- **Domain:** new `lib/tariffs/resolve.ts` with resolver functions.
- **Validation:** new `lib/validation/tariffs.ts` with Zod schemas.
- **UI:** new route group `app/(settings)/settings/` with tariffs and sms-prices pages.
- **Navigation:** top-bar gains "Налаштування" link.
- **Tests:** resolver unit tests with all priority combinations, catch-all invariant tests, validation tests.
- **No new dependencies** — uses existing Drizzle, Zod, shadcn/ui stack.

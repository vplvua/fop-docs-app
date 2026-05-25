## 1. Database Schema & Migration

- [x] 1.1 Create `lib/db/schema/tariffs.ts` — Drizzle tables: `tariffs` (id uuid PK, apartments_min integer NOT NULL default 0, apartments_max integer nullable, price numeric(10,2) NOT NULL, effective_from date NOT NULL, created_at, updated_at; UNIQUE on (apartments_min, apartments_max, effective_from)) and `sms_prices` (id uuid PK, price numeric(10,2) NOT NULL, effective_from date NOT NULL UNIQUE, created_at). Export types.
- [x] 1.2 Register `tariffs` in `lib/db/schema/index.ts` barrel export.
- [x] 1.3 Run `drizzle-kit generate` to produce migration for both tables. Rename to `0004_add_tariffs.sql`.
- [x] 1.4 Create seed migration `0005_seed_tariffs.sql` — INSERT catch-all tariff (apartments_min=0, apartments_max=NULL, price=200, effective_from='2024-01-01') and SMS price (price=1.40, effective_from='2024-01-01') with ON CONFLICT DO NOTHING.
- [x] 1.5 Apply both migrations to Neon dev branch via `drizzle-kit migrate`.

## 2. Domain — Price Resolver

- [x] 2.1 Create `lib/tariffs/resolve.ts` with `resolveAccessPrice(client: { apartmentsCount: number | null; accessPriceOverride: string | null }, tariffs: Tariff[], paymentDate: string): string | null` — implements override → ranged (narrowest) → catch-all priority with effective_from filtering.
- [x] 2.2 Create `resolveSmsPrice(smsPrices: SmsPrice[], paymentDate: string): string | null` — returns price from latest effective_from ≤ paymentDate.
- [x] 2.3 Create `lib/tariffs/index.ts` barrel export.

## 3. Validation Schemas

- [x] 3.1 Create `lib/validation/tariffs.ts` with `createTariffSchema` (price required decimal string, effective_from required date, apartments_min optional integer default 0, apartments_max optional integer nullable) and `createSmsPriceSchema` (price required decimal string, effective_from required date).

## 4. Server Actions

- [x] 4.1 Create `app/(settings)/settings/tariffs/actions.ts` — `createTariff` and `deleteTariff` server actions. In `deleteTariff`: check catch-all invariant before delete. Log events.
- [x] 4.2 Create `app/(settings)/settings/sms-prices/actions.ts` — `createSmsPrice` and `deleteSmsPrice` server actions. Log events.

## 5. UI — Settings Layout & Navigation

- [x] 5.1 Create `app/(settings)/settings/layout.tsx` — shared layout with sidebar/tab nav linking to tariffs and sms-prices pages.
- [x] 5.2 Add "Налаштування" link to the top-bar navigation component (alongside "Клієнти").

## 6. UI — Tariffs Page

- [x] 6.1 Create `app/(settings)/settings/tariffs/page.tsx` — server component that fetches all tariffs, renders table (columns: apartments_min, apartments_max or "∞", price, effective_from, delete button) and create form.
- [x] 6.2 Create tariff create form component and tariff table component (client components with useActionState).

## 7. UI — SMS Prices Page

- [x] 7.1 Create `app/(settings)/settings/sms-prices/page.tsx` — server component that fetches all SMS prices, renders table (columns: price, effective_from, delete button) and create form.
- [x] 7.2 Create SMS price create form and table components.

## 8. Tests

- [x] 8.1 Create `tests/unit/tariffs/resolve.test.ts` — test `resolveAccessPrice` with all priority cases: override wins, ranged over catch-all, narrower range wins, latest effective_from wins, payment date filtering, null apartments_count, no matching rules.
- [x] 8.2 Test `resolveSmsPrice` — single price, multiple versions, no applicable price.
- [x] 8.3 Create `tests/unit/validation/tariffs.test.ts` — test `createTariffSchema` and `createSmsPriceSchema`: valid inputs, missing price, invalid date, optional apartments_max.

## 9. Quality & Finalization

- [x] 9.1 Run `npm run qa` — all 6 gates green.
- [x] 9.2 Manual smoke test: view tariffs page with seed data, create ranged rule, delete ranged rule, try to delete last catch-all (blocked). View SMS prices, create new, delete.

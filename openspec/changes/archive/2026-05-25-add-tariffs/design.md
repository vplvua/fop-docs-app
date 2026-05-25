## Context

S2 (clients) and S3 (contracts) are complete. Clients have `access_price_override` (nullable decimal) and `apartments_count` (nullable integer) — both are inputs to the price resolver. The classifier (S7) will call `resolveAccessPrice` and `resolveSmsPrice` to determine `unit_price` for each payment. This slice builds the tariff data layer, resolver logic, and settings UI.

Current stack: Drizzle ORM over Neon HTTP driver (no `db.transaction()`), Zod validation, server actions with `useActionState`, shadcn/ui components.

## Goals / Non-Goals

**Goals:**

- `tariffs` and `sms_prices` tables with appropriate constraints.
- `resolveAccessPrice(client, paymentDate)` — pure function: client override → ranged (narrowest) → catch-all, versioned by `effective_from`.
- `resolveSmsPrice(paymentDate)` — pure function: latest `effective_from ≤ paymentDate`.
- Catch-all invariant enforced at domain layer (block delete of last catch-all).
- `/settings/tariffs` UI — table of tariff rules with create/delete actions.
- `/settings/sms-prices` UI — table of SMS prices with create/delete actions.
- Seed migration with starter data (1 catch-all tariff, 1 SMS price).
- Navigation link to settings area.

**Non-Goals:**

- Range overlap validation in S4 — the PRD mentions it (FR-SET-01) but the actual classifier only picks the narrowest matching rule, so overlaps are harmless. A visual warning can be added later.
- Historical price immutability (FR-SET-02 "historical SmsPrice read-only") — deferred until S8 when acts exist. For now, all prices are deletable.
- Price editing — FR-TAR-03 says "add new row, don't edit existing". The UI only provides create + delete, no edit.

## Decisions

### D-S4-01: Resolver lives in `lib/tariffs/`, not in `lib/db/`

**Choice:** `resolveAccessPrice` and `resolveSmsPrice` are pure functions in `lib/tariffs/resolve.ts`. They accept arrays of tariff/price rows plus client data — no direct DB calls inside.

**Why:** `lib/` must stay pure (no Next.js imports). The resolver should be independently testable with mock data. The server action or classifier calls the DB, then passes results to the resolver.

**Alternative:** DB-query-aware resolvers — rejected because it couples domain logic to the data layer.

### D-S4-02: No edit action, only create + delete

**Choice:** Tariff rows and SMS prices have create and delete actions only. No update/edit.

**Why:** FR-TAR-03 explicitly says "add a new row with a later `effective_from`, don't edit existing". This preserves price history naturally.

### D-S4-03: Catch-all invariant at application layer

**Choice:** Before deleting a tariff, check if it's the last catch-all (`apartments_max IS NULL`). If yes, block with error.

**Why:** This cannot be expressed as a simple DB constraint. The domain layer is the right place for business invariants. FR-TAR-02.

### D-S4-04: Seed data in a separate SQL migration

**Choice:** Seed the catch-all tariff and initial SMS price via a second migration file (`0005_seed_tariffs.sql`) with `INSERT ... ON CONFLICT DO NOTHING`.

**Why:** Idempotent — safe to re-run. Keeps schema DDL and seed DML separate. The `ON CONFLICT` prevents duplicates if the seed has already been applied.

### D-S4-05: Settings layout with shared navigation

**Choice:** Create `app/(settings)/settings/layout.tsx` with a sidebar/tab nav linking to `/settings/tariffs` and `/settings/sms-prices`. Future slices (S5) will add more entries.

**Why:** Settings is a multi-page area. A shared layout provides consistent navigation. The PRD groups tariffs and SMS prices under settings (FR-SET-01, FR-SET-02).

### D-S4-06: Top-bar navigation

**Choice:** Add "Налаштування" link to the top-bar navigation alongside "Клієнти".

**Why:** Settings pages need a top-level entry point. Consistent with how "Клієнти" was added in S2.

## Risks / Trade-offs

- **[No transactions for seed]** → Neon HTTP driver doesn't support transactions. Seed INSERTs are two independent statements. `ON CONFLICT DO NOTHING` makes them safe.
- **[No overlap validation]** → Overlapping ranges are technically valid — the resolver picks the narrowest. A visual warning could be added in Phase 1 but isn't a correctness issue.
- **[Delete allowed for all prices]** → Until S8 introduces acts, there's no way to check if a price was used in a historical act. FR-SET-02 "read-only for historical" is deferred.

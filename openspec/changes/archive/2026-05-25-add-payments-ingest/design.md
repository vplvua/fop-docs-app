## Context

S3/S4/S5 are complete. The `settings` table has `privatbank_polling_interval_minutes` (default 60). The `integration_health` table (from S0) is ready for writes. This is the first slice that calls an external API and registers a Vercel Cron Job.

The project uses Neon HTTP driver (no `db.transaction()` yet). D-039 specifies MSW for HTTP mocks. The `lib/external-apis/privatbank/` directory exists as an empty scaffold from S0.

## Goals / Non-Goals

**Goals:**

- `payments` table with status enum, UNIQUE `bank_transaction_id`, `raw_data` JSONB.
- PrivatBank HTTP client in `lib/external-apis/privatbank/` — `fetchTransactions(token, dateFrom, dateTo)` with retry/backoff.
- Payload mapping: API fields → Payment columns (FR-PAY-05).
- Idempotent insert via `ON CONFLICT (bank_transaction_id) DO NOTHING`.
- Cron handler at `app/api/cron/privatbank-poll/route.ts` — reads interval from settings, calculates overlapping window (2× interval), calls API, inserts payments, updates `integration_health`.
- Server action `triggerPrivatbankPollNow` for dashboard manual trigger.
- `/payments` list page with status/period/text-search filters.
- `/payments/[id]` card page with collapsible `raw_data` JSON.
- "Платежі" link in top-bar.
- MSW setup for HTTP mock tests (D-039).

**Non-Goals:**

- Classification logic — that's S7. Payments land with `status = received`.
- Manual classification UI on payment card — that's S7.
- Dashboard health banner wiring — that's S13. The cron writes to `integration_health` but the dashboard doesn't read it yet.
- Real PrivatBank token in dev — tests use MSW mocks. Production token is added via `vercel env add`.

## Decisions

### D-S6-01: Neon HTTP driver is sufficient for S6

**Choice:** Continue with `@neondatabase/serverless` HTTP driver. No transactions needed for payment insert — a single `INSERT ... ON CONFLICT DO NOTHING` is inherently atomic.

**Why:** Transaction support (switching to `neon-serverless` Pool) is only needed when S7 adds `SELECT ... FOR UPDATE` on payments. For S6, single-statement idempotent inserts are sufficient.

### D-S6-02: PrivatBank HTTP client with native fetch

**Choice:** Use Node.js native `fetch` in `lib/external-apis/privatbank/client.ts`. No axios/got dependency.

**Why:** Minimal dependencies. The client only does `GET` with a bearer token. Retry/backoff is simple to implement with a loop and `setTimeout`.

### D-S6-03: Payment status as pgEnum

**Choice:** Define `paymentStatusEnum` as a Postgres enum: `received`, `classified`, `awaiting_review`, `in_queue`, `skipped`. All payments start as `received`. Other statuses are set by S7 (classifier).

**Why:** Enum provides type safety and self-documenting schema. The full set is defined now so the migration doesn't need to `ALTER TYPE` later.

### D-S6-04: Overlapping polling window

**Choice:** Each poll fetches `2 × interval` worth of transactions. E.g., if interval is 60 min, fetch the last 120 min.

**Why:** FR-PAY-02. Covers gaps from missed polls (network issues, cold starts). The UNIQUE constraint on `bank_transaction_id` + `ON CONFLICT DO NOTHING` makes overlapping safe.

### D-S6-05: Cron schedule in vercel.ts

**Choice:** Register `0 * * * *` (every hour) in `vercel.ts` crons. The actual interval behavior (overlapping window size) is controlled by the `privatbank_polling_interval_minutes` setting, not the cron schedule.

**Why:** Vercel Cron Jobs have a minimum granularity of 1 minute. The hourly schedule matches the default interval. If the admin changes the interval, the overlapping window adjusts but the cron still fires hourly — missing windows are covered by overlap.

### D-S6-06: MSW for HTTP mocks (D-039)

**Choice:** Install `msw` as devDependency. Mock handlers in `tests/mocks/handlers/privatbank.ts`. Unit tests for the HTTP client use MSW's `setupServer`.

**Why:** D-039 mandates MSW as the sole HTTP mock strategy. No inline `vi.mock` on fetch.

### D-S6-07: Payments list in dashboard route group

**Choice:** Payments pages live under `app/(dashboard)/payments/` — same route group as clients and the dashboard. This way they share the top-bar layout.

**Why:** Payments are a primary navigation item alongside clients. No need for a separate route group.

## Risks / Trade-offs

- **[No real PrivatBank token in dev]** → All tests use MSW mocks. The first real poll happens after `vercel env add PRIVATBANK_TOKEN` in production. The overlapping window and idempotent insert provide resilience.
- **[Cron fires hourly regardless of setting]** → If admin sets interval to 30 min, the cron still fires hourly. This is acceptable for MVP — the overlapping window (2×30=60 min) still covers the gaps. A more granular approach would use Vercel Queues (Phase 1+).
- **[No pagination on payments list]** → MVP scale is ~500 payments/month. With a 12-month window, ~6000 rows. Period filter keeps the displayed set manageable. Pagination can be added in Phase 1.

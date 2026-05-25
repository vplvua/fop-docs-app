## Why

S3 (contracts), S4 (tariffs), and S5 (settings) are complete — all prerequisites for the payment pipeline. This slice adds the first external API integration: polling PrivatBank Автоклієнт API for incoming payments. Without payments in the DB, the classifier (S7) and act generation (S8) have nothing to work with. This is the entry point for all downstream data flow.

## What Changes

- New `payments` table with status enum (`received`, `classified`, `awaiting_review`, `in_queue`, `skipped`), `raw_data` JSONB, UNIQUE `bank_transaction_id`.
- `lib/external-apis/privatbank/` — HTTP client with retry/backoff (1s/5s/30s), error mapping (401→stop, 5xx→retry, 429→Retry-After).
- Domain: parse PrivatBank payload → Payment fields mapping (FR-PAY-05), idempotent INSERT via ON CONFLICT DO NOTHING.
- Cron handler `app/api/cron/privatbank-poll/route.ts` registered in `vercel.ts` with `0 * * * *` schedule.
- Server action `triggerPrivatbankPollNow` for manual trigger button.
- Observability: cron handler updates `integration_health(service='privatbank')` after each cycle.
- UI: `/payments` (list with filters by status, period, text search) and `/payments/[id]` (card with raw_data JSON viewer).
- Navigation: "Платежі" link in top-bar.

## Capabilities

### New Capabilities

- `payments-ingest`: PrivatBank polling, payment storage, payments UI. Covers FR-PAY-01 through FR-PAY-08, NFR-PERF-01, TC-INTEG-01, TC-INTEG-10.

### Modified Capabilities

_(none)_

## Impact

- **DB:** new migration for `payments` table with status enum + indexes.
- **Schema:** new `lib/db/schema/payments.ts`.
- **External API:** new `lib/external-apis/privatbank/` HTTP client.
- **Cron:** first cron job in `vercel.ts`.
- **UI:** new route group for payments pages, top-bar nav updated.
- **Observability:** `integration_health` writes for PrivatBank.
- **Tests:** unit (payload mapping, idempotency), HTTP mock tests via MSW (401, 429, 5xx), validation tests.
- **New dependency:** MSW for HTTP mocks (D-039, deferred from S0 to S6).

## Context

Payments enter the system only through the hourly cron poll of PrivatBank's `/interim` endpoint (`lib/external-apis/privatbank/`). The `poll.ts` orchestrator fetches confirmed transactions, maps them via `mapTransaction` (`bank_transaction_id = REF + REFN`), inserts with `ON CONFLICT (bank_transaction_id) DO NOTHING`, and triggers `classifyInserted` for new rows. There is no on-demand path to recover a missed or pre-launch payment.

PrivatBank exposes a dated statement endpoint (confirmed in `docs/api-docs/Privatbank_API.pdf`): `GET /api/statements/transactions?acc=...&startDate=DD-MM-YYYY&endDate=DD-MM-YYYY&followId=...&limit=100`, same `token` header and identical response shape as `/interim` (`status`, `exist_next_page`, `next_page_id`, `transactions[]`). This change adds an admin-driven import built on that endpoint, and introduces the shared `payments.source` column that the follow-up `add-manual-act` change depends on.

Constraints: `lib/` must stay pure (no Next imports); external HTTP mocked with MSW (D-039); DB not mocked (real Neon test branch); dev/prod are separate Neon branches so prod is migrated separately (`docs/operations.md`).

## Goals / Non-Goals

**Goals:**

- Let the admin pull real PrivatBank transactions for a known date and import a selected one as a first-class payment that flows through existing classification.
- Make double-import structurally impossible across the poll and by-date paths.
- Introduce `payments.source` / `bank_label` as shared provenance foundation.
- Maximize reuse of the existing client (paging, retry, filter, mapper) and classification trigger.

**Non-Goals:**

- Manual act creation and other-bank (non-PrivatBank) payments — that is `add-manual-act`.
- Bulk import of an entire date range in one click (UI imports one selected transaction at a time; range fetch is allowed for listing).
- Any change to the existing cron poll behavior or schedule.

## Decisions

### D1: Extend the existing client rather than add a parallel one

Add `fetchTransactionsByDate(token, acc, startDate, endDate)` to `lib/external-apis/privatbank/client.ts`, factoring the shared paging/retry into a small internal helper so both `/interim` (existing `fetchTransactions`) and the dated endpoint reuse it. Rationale: the response schema, confirmed-filter, pagination, and error handling are identical — a parallel client would duplicate retry/backoff logic. Alternative (separate module) rejected as redundant.

Date formatting: convert the admin's `YYYY-MM-DD` input to the API's `DD-MM-YYYY` at the client boundary (pure helper, unit-tested). `endDate` defaults to `startDate` for a single-day fetch.

### D2: Two-layer dedup, same key as polling

- **Layer 1 (read-time, advisory):** a pure helper `annotateWithExisting(transactions, existingById)` merges fetched transactions with a single `SELECT id, bank_transaction_id, status, act_id FROM payments WHERE bank_transaction_id = ANY($ids)`. Output marks each row `new` or `already_imported` (carrying payment id/status/act_id). This drives the UI badge + link and disables re-import.
- **Layer 2 (write-time, authoritative):** import uses `INSERT ... ON CONFLICT (bank_transaction_id) DO NOTHING RETURNING id`. Empty return ⇒ the row already existed (e.g. a poll landed between fetch and click) ⇒ look up the existing id and route the admin there; never insert a duplicate.

Rationale: Layer 1 is pure/testable and gives immediate feedback; Layer 2 reuses the exact unique key (`REF+REFN`) and conflict strategy polling already relies on, so the two ingestion paths cannot double-insert by construction. Alternative (read-time check only) rejected — it has a TOCTOU gap that Layer 2 closes.

### D3: Import triggers classification, identical to polling

On a successful insert, fire the same `classifyInserted` path `poll.ts` uses (fire-and-forget, failure does not roll back the payment). Rationale: a by-date PrivatBank payment is indistinguishable from a polled one — it should auto-classify into an act with zero special-casing.

### D4: `source` as a pgEnum with safe default + backfill

Add `payment_source` pgEnum (`'privatbank' | 'manual_external'`) and `payments.source NOT NULL DEFAULT 'privatbank'`; existing rows backfill to `'privatbank'` via the default. Add nullable `bank_label text` (unused here, reserved for `add-manual-act`). Rationale: default + NOT NULL backfills existing data in one statement; enum keeps the taxonomy closed. This change owns the migration; `add-manual-act` only reads/writes the columns. Alternative (boolean `is_manual`) rejected — an enum scales to future sources and reads clearly.

### D5: UI as a new route segment, server-action driven

A page under the payments area (consistent with the existing `/payments` route group) renders a date form. Submitting calls a server action that fetches + annotates and returns the list; a per-row import server action performs the guarded insert and returns the target payment id for navigation. Badges use DESIGN.md semantic tokens (`semantic-success` / `muted`). Rationale: matches the established RSC + server-action + `router.refresh()` pattern used across the app.

## Risks / Trade-offs

- **TOCTOU between fetch and import** → Layer 2 `ON CONFLICT DO NOTHING` makes the write idempotent; the admin is routed to the existing payment instead of seeing an error.
- **Bank returns a transaction we filter out (non-confirmed)** → reuse the existing `PR_PR === 'r' && FL_REAL === 'r'` filter so by-date results match what polling would have ingested; non-confirmed transactions never appear as importable.
- **Large date range returns many pages / slow** → UI nudges toward single-day fetch; `limit=100` + `followId` paging already bounded; range is opt-in.
- **Migration on prod forgotten** → follow `docs/operations.md` runbook; `source` has a default so the column is safe to add before code that writes non-default values ships.
- **Schema coupling with `add-manual-act`** → this change introduces `source`/`bank_label`; the follow-up only consumes them, avoiding a migration conflict.

## Migration Plan

1. Add `payment_source` enum + `source` (NOT NULL default `'privatbank'`) + `bank_label` (nullable) to `lib/db/schema/payments.ts`; generate migration; apply on dev Neon branch via `npm run db:migrate`.
2. Ship client + server actions + UI + MSW handler + tests behind the new route.
3. Apply the migration on the prod Neon branch separately per `docs/operations.md`.
4. Rollback: the feature is additive (new route, new column with default). Reverting code leaves the harmless `source`/`bank_label` columns in place; no data migration needed to roll back.

## Open Questions

- Default date shown on the form: today vs. last successful poll boundary. Leaning "today" for simplicity; not blocking.

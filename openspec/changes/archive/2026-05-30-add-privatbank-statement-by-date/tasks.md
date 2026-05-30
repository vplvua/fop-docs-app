## 1. Schema & migration (shared foundation)

- [x] 1.1 Add `payment_source` pgEnum (`'privatbank' | 'manual_external'`) and `source` column (NOT NULL, default `'privatbank'`) + nullable `bank_label` text to `lib/db/schema/payments.ts`
- [x] 1.2 Generate migration (`npm run db:generate`) — verify it backfills existing rows to `'privatbank'` via the default
- [x] 1.3 Apply migration on dev Neon branch (`npm run db:migrate`)

## 2. PrivatBank client — dated statement fetch

- [x] 2.1 Add a pure `toApiDate(yyyymmdd)` helper converting `YYYY-MM-DD` → `DD-MM-YYYY`
- [x] 2.2 Factor the shared paging/retry/confirmed-filter loop out of `fetchTransactions` so it is reused by both endpoints
- [x] 2.3 Add `fetchTransactionsByDate(token, acc, startDate, endDate?)` hitting `/api/statements/transactions` with `acc`/`startDate`/`endDate`/`limit=100`/`followId`; default `endDate` to `startDate`
- [x] 2.4 Export `fetchTransactionsByDate` from `lib/external-apis/privatbank/index.ts`
- [x] 2.5 Add MSW handler for the dated endpoint in `tests/mocks/handlers/privatbank.ts` (success, pagination, non-confirmed filtered out)

## 3. Dedup annotation (pure helper)

- [x] 3.1 Add pure `annotateWithExisting(transactions, existing)` that maps each mapped transaction to `{ payment, status: 'new' | 'already_imported', existingPaymentId?, existingStatus?, actId? }`
- [x] 3.2 Unit-test annotation: all-new, all-existing, mixed, and act-linked cases

## 4. Server actions

- [x] 4.1 `fetchStatementByDateAction(startDate, endDate?)`: call `fetchTransactionsByDate`, map via `mapTransaction`, run a single `SELECT ... WHERE bank_transaction_id = ANY(...)`, return annotated list; record `integration_health` success/error
- [x] 4.2 `importStatementTransactionAction(transactionId/payload)`: `INSERT ... ON CONFLICT (bank_transaction_id) DO NOTHING RETURNING id` with `source='privatbank'`, `raw_data` = original payload; on new row trigger `classifyInserted`; on conflict resolve and return the existing payment id
- [x] 4.3 Ensure import is server-validated against the fetched payload (do not trust client-supplied amount/date — re-map from raw) — import re-fetches by date and matches by `REF+REFN` server-side

## 5. UI — «Завантажити платіж за датою»

- [x] 5.1 New page in the payments route group with a date (single-day default) / optional range form
- [x] 5.2 Render the annotated transaction list: `new` rows show «Імпортувати»; `already_imported` rows show a disabled «Вже в системі» badge linking to `/payments/{id}` (and the act when `act_id` set)
- [x] 5.3 Wire per-row import to the server action; on success `router.refresh()` / navigate to the created (or existing) payment
- [x] 5.4 Use DESIGN.md semantic tokens for badges/states; empty state when no transactions / all imported
- [x] 5.5 Add a navigation entry/link to the new page from the payments area

## 6. Quality gate & verification

- [x] 6.1 Unit tests green: client-by-date via MSW, date helper, annotation helper (mapper reused) — 350/350 tests pass (16 new)
- [x] 6.2 `npm run qa` 6/6 (lint → format:check → typecheck → test:run → build → openspec validate) — all gates green
- [x] 6.3 Manual smoke on dev Neon branch: fetch a real date, import a new transaction (→ classifies), attempt re-import (→ routed to existing, no duplicate); capture Real-behavior-proof for PR — verified locally + on prod (statement pull works)
- [x] 6.4 Apply migration on prod Neon branch per `docs/operations.md` — applied on prod

## 1. Database Schema & Migration

- [x] 1.1 Create `lib/db/schema/payments.ts` — pgEnum `payment_status` (`received`, `classified`, `awaiting_review`, `in_queue`, `skipped`); table `payments` with id (uuid PK), bank_transaction_id (text UNIQUE NOT NULL), payment_date (date NOT NULL), amount (numeric(10,2) NOT NULL), purpose (text NOT NULL), payer_name (text NOT NULL), payer_legal_id (text NOT NULL), payer_bank_account (text), raw_data (jsonb NOT NULL), status (payment_status NOT NULL default 'received'), classification_reason (text), parsed_contract_numbers (text[]), client_id (uuid FK nullable), service_type (text), unit_price (numeric), quantity (numeric), quantity_unit (text), act_id (uuid nullable), created_at, updated_at. Indexes on status, payment_date, client_id.
- [x] 1.2 Register in `lib/db/schema/index.ts`.
- [x] 1.3 Run `drizzle-kit generate` → rename to `0008_add_payments.sql`.
- [x] 1.4 Apply migration.

## 2. PrivatBank HTTP Client

- [x] 2.1 Create `lib/external-apis/privatbank/client.ts` — `fetchTransactions(token: string, dateFrom: string, dateTo: string): Promise<PrivatBankTransaction[]>` using native fetch with Authorization bearer header. Implement retry logic: 3 retries with 1s/5s/30s backoff for 5xx/network errors; respect Retry-After for 429; throw typed errors for 401.
- [x] 2.2 Create `lib/external-apis/privatbank/types.ts` — TypeScript types for API response and `PrivatBankTransaction`.
- [x] 2.3 Create `lib/external-apis/privatbank/mapper.ts` — `mapTransaction(tx: PrivatBankTransaction): NewPayment` mapping API fields to DB columns (FR-PAY-05).
- [x] 2.4 Create `lib/external-apis/privatbank/index.ts` barrel export.

## 3. Polling Domain Logic

- [x] 3.1 Create `lib/external-apis/privatbank/poll.ts` — `pollPrivatbank(): Promise<{inserted: number; total: number}>` that reads interval from settings, calculates overlapping window (2× interval), calls fetchTransactions, maps and inserts payments idempotently, updates integration_health. Returns count of new inserts.

## 4. Cron Handler & Server Action

- [x] 4.1 Create `app/api/cron/privatbank-poll/route.ts` — GET handler that calls `pollPrivatbank()`, returns JSON result. Guard with `CRON_SECRET` header check (Vercel Cron security).
- [x] 4.2 Register cron in `vercel.ts`: `{ path: '/api/cron/privatbank-poll', schedule: '0 * * * *' }`.
- [x] 4.3 Create server action `triggerPrivatbankPollNow` in `app/(dashboard)/payments/actions.ts` that calls `pollPrivatbank()` and returns result.

## 5. UI — Payments Pages

- [x] 5.1 Create `app/(dashboard)/payments/page.tsx` — server component fetching payments with status/period/search filters from URL params. Render table with columns: date, amount, purpose (truncated), payer, status badge.
- [x] 5.2 Create `app/(dashboard)/payments/[id]/page.tsx` — payment card with all fields + collapsible raw_data JSON viewer.
- [x] 5.3 Add "Платежі" link to `app/components/top-bar.tsx` nav between Клієнти and Налаштування.

## 6. MSW Setup & Tests

- [x] 6.1 Install `msw` as devDependency. Create `tests/mocks/handlers/privatbank.ts` with default handler returning sample transactions.
- [x] 6.2 Create `tests/unit/payments/mapper.test.ts` — test mapTransaction with standard payload and edge cases (missing optional fields).
- [x] 6.3 Create `tests/unit/payments/client.test.ts` — test fetchTransactions via MSW: success, 401 error, 5xx retry, 429 retry-after.

## 7. Quality & Finalization

- [x] 7.1 Run `npm run qa` — all 6 gates green.
- [x] 7.2 Manual smoke test: start dev server, navigate to `/payments` (empty list), verify cron endpoint responds, verify payment card page works with mock data.

# payments-ingest Specification

## Purpose

PrivatBank Автоклієнт API polling, payment storage, and payments UI. Cron-driven ingestion with idempotent inserts, retry/backoff error handling, and manual trigger. Covers FR-PAY-01..08, NFR-PERF-01, TC-INTEG-01, TC-INTEG-10.

## Requirements

### Requirement: Cron polls PrivatBank API on interval

The system SHALL run a cron job (`0 * * * *`) that calls the PrivatBank Автоклієнт API to fetch incoming transactions. The request period SHALL be an overlapping window of `2 × Settings.privatbank_polling_interval_minutes` ending at the current time. Each transaction SHALL be inserted into the `payments` table with `status = received`.

Covers: FR-PAY-01, FR-PAY-02.

#### Scenario: Successful poll with new transactions

- **WHEN** the cron fires and PrivatBank returns 3 transactions
- **THEN** 3 rows SHALL be inserted into `payments` with `status = 'received'` and `integration_health(service='privatbank')` SHALL be updated with `last_success_at = now()`

#### Scenario: Poll with no new transactions

- **WHEN** the cron fires and PrivatBank returns 0 transactions
- **THEN** no rows SHALL be inserted, and `integration_health` SHALL still record a successful poll

### Requirement: Payment insert is idempotent

The system SHALL insert payments using `INSERT ... ON CONFLICT (bank_transaction_id) DO NOTHING`. Duplicate transactions from overlapping windows SHALL be silently skipped. The `raw_data` of the first insert SHALL be preserved (canonical version).

Covers: FR-PAY-03, FR-PAY-04, TC-INTEG-10.

#### Scenario: Duplicate transaction

- **WHEN** the same `bank_transaction_id` arrives in two consecutive polls
- **THEN** only one `payments` row SHALL exist, and its `raw_data` SHALL match the first poll's payload

### Requirement: PrivatBank payload mapping

The system SHALL map PrivatBank API fields to `Payment` columns: `id` → `bank_transaction_id`, `date` → `payment_date`, `amount` → `amount`, `purpose` → `purpose`, `payer.name` → `payer_name`, `payer.legal_id` → `payer_legal_id`, `payer.iban` → `payer_bank_account`. The full API response object SHALL be stored in `raw_data` (JSONB).

Covers: FR-PAY-05.

#### Scenario: Standard payment mapping

- **WHEN** PrivatBank returns `{id: "PB123", date: "2026-04-05", amount: "200.00", purpose: "Оплата по договір №556770", payer: {name: "ОСББ Тест", legal_id: "12345678", iban: "UA12..."}}`
- **THEN** a `payments` row SHALL be created with `bank_transaction_id = 'PB123'`, `payment_date = '2026-04-05'`, `amount = '200.00'`, `purpose` matching the input, `payer_name = 'ОСББ Тест'`, `payer_legal_id = '12345678'`, `payer_bank_account = 'UA12...'`

### Requirement: PrivatBank API error handling

The HTTP client SHALL handle errors: on `401` → stop polling, record error in `integration_health`; on `5xx`/network error → retry 3 times with backoff (1s/5s/30s); on `429` → respect `Retry-After` header. After 4+ consecutive failures, `integration_health` SHALL record the error for dashboard display.

Covers: FR-PAY-06, FR-PAY-07.

#### Scenario: 401 Unauthorized

- **WHEN** PrivatBank returns 401
- **THEN** polling SHALL stop (no retries), `integration_health` SHALL record `last_error_code = '401'` and `last_error_message` describing token issue

#### Scenario: 5xx with successful retry

- **WHEN** PrivatBank returns 500 on first attempt but 200 on second retry
- **THEN** the transactions from the successful retry SHALL be inserted normally

#### Scenario: 429 with Retry-After

- **WHEN** PrivatBank returns 429 with `Retry-After: 60`
- **THEN** the client SHALL wait 60 seconds before retrying

### Requirement: Manual poll trigger

The system SHALL provide a server action `triggerPrivatbankPollNow` that runs the same polling logic as the cron, callable from a dashboard button. The action SHALL return the count of new payments inserted.

Covers: FR-PAY-08.

#### Scenario: Manual trigger inserts payments

- **WHEN** the admin triggers manual poll and PrivatBank returns 2 new transactions
- **THEN** 2 rows SHALL be inserted and the action SHALL return `{count: 2}`

### Requirement: Payments list page

The system SHALL provide a `/payments` page displaying payments in a table with columns: payment_date, amount, purpose (truncated), payer_name, status (badge), created_at. The list SHALL support filters: status (multi-select), period (date range), and text search on purpose/payer_name.

Covers: FR-PAY-01 (visibility).

#### Scenario: View payments list

- **WHEN** the admin navigates to `/payments`
- **THEN** all payments SHALL be displayed sorted by `payment_date` descending

#### Scenario: Filter by status

- **WHEN** the admin selects status filter "received"
- **THEN** only payments with `status = 'received'` SHALL be displayed

### Requirement: Payment detail card

The system SHALL provide a `/payments/[id]` page showing all payment fields and a collapsible `raw_data` JSON viewer. The card SHALL display the status badge prominently. The card SHALL also display a classification action panel with context-dependent controls: "Класифікувати" and "Пропустити" buttons for actionable statuses (`received`, `awaiting_review`, `in_queue`); classification reason details for `in_queue`/`awaiting_review`; a link to the created act for `classified`; a "Пропущено" badge for `skipped`. When the status is `awaiting_review` with `classification_reason` containing `multiple_clients_same_edrpou`, the panel SHALL additionally show a warning that several active clients share the payer EDRPOU and a selector listing only those active clients; archived clients SHALL NOT appear in the selector.

Covers: FR-PAY-04 (raw_data visible), FR-CLASS-01 (manual reclassify entry point).

#### Scenario: View payment card

- **WHEN** the admin navigates to `/payments/[id]`
- **THEN** all payment fields SHALL be displayed, and `raw_data` SHALL be visible in a collapsible JSON panel

#### Scenario: Action panel for received payment

- **WHEN** the admin views a payment with `status = received`
- **THEN** the page SHALL show "Класифікувати" and "Пропустити" buttons

#### Scenario: Action panel for classified payment

- **WHEN** the admin views a payment with `status = classified`
- **THEN** the page SHALL show a read-only link to the associated act and no action buttons

#### Scenario: Selector for multiple same-EDRPOU active clients

- **WHEN** the admin views a payment with `status = awaiting_review` and `classification_reason` containing `multiple_clients_same_edrpou`
- **THEN** the page SHALL show a warning and a selector of the active clients sharing the payer EDRPOU, and selecting one SHALL link the payment to that client and continue classification

### Requirement: Navigation includes Payments

The top-bar navigation SHALL include a "Платежі" link pointing to `/payments`.

#### Scenario: Payments link visible

- **WHEN** the admin is logged in
- **THEN** the top-bar SHALL show "Платежі" link between "Клієнти" and "Налаштування"

### Requirement: Fetch PrivatBank statement transactions by date

The system SHALL provide a dated-statement fetch that calls the PrivatBank Автоклієнт endpoint `GET https://acp.privatbank.ua/api/statements/transactions` with query parameters `acc={FOP_BANK_ACCOUNT}`, `startDate=DD-MM-YYYY` (required), `endDate=DD-MM-YYYY` (optional, defaults to `startDate`), and `limit=100`, authenticated with the `token` header (`PRIVATBANK_TOKEN`). It SHALL reuse the existing confirmed-transaction filter (`PR_PR === 'r'` AND `FL_REAL === 'r'`), the `followId`/`exist_next_page` pagination, the retry/backoff schedule (`1000/5000/30000` ms), the `401 → AuthError` / `429 → Retry-After` handling, and the `mapTransaction` mapper used by polling. On success it SHALL record `integration_health(service='privatbank')` success; on failure it SHALL record an error.

Covers: FR-PAY-09 (new).

#### Scenario: Single-day fetch returns confirmed transactions

- **WHEN** the admin requests the statement for `2026-04-28` and PrivatBank returns 3 confirmed and 1 non-confirmed transaction for that day
- **THEN** the fetch SHALL call the endpoint with `startDate=28-04-2026` and `endDate=28-04-2026`, return only the 3 confirmed transactions mapped to payment shape (each with `bank_transaction_id = REF + REFN`), and record a `privatbank` health success

#### Scenario: Paginated statement

- **WHEN** PrivatBank returns `exist_next_page: true` with a `next_page_id`
- **THEN** the fetch SHALL follow `followId` until `exist_next_page` is false and SHALL return all confirmed transactions across pages

#### Scenario: Fetch failure records health error

- **WHEN** the PrivatBank request fails after exhausting retries
- **THEN** an error SHALL be recorded for `integration_health(service='privatbank')` and the admin SHALL see a failure message (no payment is created)

### Requirement: Dedup annotation of fetched transactions

Before presenting fetched transactions to the admin, the system SHALL look up which `bank_transaction_id` values already exist in `payments` (single query over the fetched ids) and annotate each transaction as either _new_ (importable) or _already imported_. An _already imported_ transaction SHALL carry the existing payment's id, its `status`, and its `act_id` (when set) so the UI can link to the payment and its act, and SHALL NOT be importable.

Covers: FR-PAY-10 (new).

#### Scenario: Mixed new and already-imported transactions

- **WHEN** the fetched statement contains one transaction whose `bank_transaction_id` already exists in `payments` and two that do not
- **THEN** the existing one SHALL be annotated as _already imported_ with its payment id (and `act_id` if present) and marked non-importable, and the two others SHALL be annotated as _new_ and importable

#### Scenario: All transactions already imported

- **WHEN** every fetched transaction already exists in `payments`
- **THEN** every row SHALL be annotated _already imported_ and the list SHALL present no importable rows

### Requirement: Import a selected statement transaction as a payment

The system SHALL allow the admin to import a single selected transaction as a `payments` row using `INSERT ... ON CONFLICT (bank_transaction_id) DO NOTHING RETURNING id`, with `source = 'privatbank'` and `raw_data` set to the original transaction payload. When a new row is created, the system SHALL trigger classification for it (the same path polling uses). When the insert conflicts (the payment already existed), the system SHALL NOT create a duplicate and SHALL direct the admin to the existing payment.

Covers: FR-PAY-11 (new).

#### Scenario: Import a new transaction

- **WHEN** the admin imports a transaction whose `bank_transaction_id` is not yet in `payments`
- **THEN** one `payments` row SHALL be inserted with `source = 'privatbank'` and `status = 'received'`, classification SHALL be triggered for it, and the admin SHALL be routed to the created payment

#### Scenario: Import conflicts with an existing payment

- **WHEN** the admin imports a transaction whose `bank_transaction_id` already exists (e.g. a poll inserted it between fetch and import)
- **THEN** no new row SHALL be inserted, and the admin SHALL be directed to the existing payment with a message that it is already in the system

#### Scenario: By-date and poll paths cannot double-insert

- **WHEN** the same transaction is both polled and imported by date
- **THEN** exactly one `payments` row SHALL exist for that `bank_transaction_id`, because both paths share the `ON CONFLICT (bank_transaction_id) DO NOTHING` guard

### Requirement: Payment provenance via source

The `payments` table SHALL carry a `source` column of type `payment_source` (`'privatbank' | 'manual_external'`), NOT NULL, default `'privatbank'`, with all pre-existing rows backfilled to `'privatbank'`. It SHALL also carry a nullable `bank_label` text column identifying the originating bank for non-PrivatBank payments. Transactions ingested from PrivatBank (both polling and by-date import) SHALL have `source = 'privatbank'` and `bank_label = null`.

Covers: FR-PAY-12 (new).

#### Scenario: PrivatBank import sets source

- **WHEN** a transaction is imported via the by-date statement path
- **THEN** the created payment SHALL have `source = 'privatbank'` and `bank_label = null`

#### Scenario: Existing rows backfilled

- **WHEN** the migration adding `source` runs against a table with existing payments
- **THEN** every pre-existing payment SHALL have `source = 'privatbank'`

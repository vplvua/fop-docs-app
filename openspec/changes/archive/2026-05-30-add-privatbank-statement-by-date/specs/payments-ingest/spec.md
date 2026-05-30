## ADDED Requirements

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

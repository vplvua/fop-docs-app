## ADDED Requirements

### Requirement: Manual act creation form

The system SHALL provide an admin page «Створити акт вручну» that collects: a client (selectable only from clients that have a contract), the act period (a month + year), a service type (`access` or `sms`), a quantity, and an amount. On selecting a client and service the system SHALL pre-fill the unit price from the effective tariff (`resolveAccessPrice` / `resolveSmsPrice`) and a default quantity as a hint; the admin SHALL be able to override quantity and amount. The form SHALL be server-validated (Zod) before any act is created.

Covers: FR-MACT-01, FR-MACT-02 (new).

#### Scenario: Client picker excludes contractless clients

- **WHEN** the admin opens the manual act form
- **THEN** the client selector SHALL list only clients that have a contract, because the PDF requires `contract_snapshot`

#### Scenario: Tariff pre-fills price as an overridable hint

- **WHEN** the admin selects a client and the `access` service
- **THEN** the unit price SHALL be pre-filled from the effective access tariff for that client and the amount SHALL be computed from price × quantity, while remaining editable

#### Scenario: Invalid input rejected

- **WHEN** the admin submits with a missing service, non-positive quantity, or non-positive amount
- **THEN** the server SHALL reject the submission and SHALL NOT create a payment or act

### Requirement: Act period decoupled from payment date

The manual act's `act_date` SHALL be the last day of the admin-chosen period month, independent of the backing payment's `payment_date`. The system SHALL NOT derive the period from the payment date for manual acts.

Covers: FR-MACT-03 (new).

#### Scenario: Period chosen independently

- **WHEN** the admin chooses period December 2025 while recording a payment dated 2026-01-10
- **THEN** the act `act_date` SHALL be `2025-12-31` and the act number SHALL be derived from December 2025

### Requirement: Manual act is backed by a manual payment

Creating a manual act SHALL first create a backing `payments` row with `source = 'manual_external'`, a synthetic unique `bank_transaction_id` of the form `manual:{uuid}`, the admin-supplied amount, a `payment_date`, an optional `bank_label`, and `payer` fields populated from the selected client. The created act SHALL reference this payment via `payment_id` (the act-always-has-a-payment invariant), and the payment SHALL be left as `status = 'classified'` with `act_id` set to the new act — mirroring the state automatic classification produces. The synthetic id SHALL never collide with a PrivatBank `REF+REFN` id.

Covers: FR-MACT-04, FR-MACT-05 (new).

#### Scenario: Backing payment created and linked

- **WHEN** the admin creates a manual act for client X, amount 200.00
- **THEN** a `payments` row SHALL exist with `source = 'manual_external'`, `bank_transaction_id` matching `manual:{uuid}`, `status = 'classified'`, `act_id` = the new act, and the act `payment_id` SHALL reference that payment

#### Scenario: Synthetic id does not collide with PrivatBank ids

- **WHEN** a manual payment id is generated
- **THEN** it SHALL be prefixed `manual:` so it cannot equal any PrivatBank `REF+REFN` value, and the unique constraint on `bank_transaction_id` SHALL hold across both sources

### Requirement: Manual act reuses numbering, snapshots, PDF and EDO pipeline

The manual act creation path SHALL assemble the act stub from the admin inputs (client/contract/FOP snapshots, service description, unit price, quantity, amount, `billing_period = monthly`) and SHALL reuse the existing race-safe per-client/month numbering (`SELECT ... FOR UPDATE`), the current FOP-requisites snapshot, PDF generation/storage in Blob, and the DubiDoc send. It SHALL NOT re-derive service/quantity/amount through automatic classification.

Covers: FR-MACT-06, FR-MACT-07 (new).

#### Scenario: Number, snapshots and PDF produced

- **WHEN** a manual act is created for a client with an existing act `12/2025` in that month
- **THEN** the new act SHALL be numbered `12/2025/2`, carry client/contract/FOP snapshots, and have a PDF generated and stored in Blob

#### Scenario: Sent to DubiDoc for signing

- **WHEN** a manual act is created for a client whose `edo_provider = dubidoc` and PDF generation succeeds
- **THEN** the act SHALL be sent to DubiDoc via the existing send path and transition to `sent_to_edo`

#### Scenario: Amounts taken from admin input, not recomputed

- **WHEN** the admin sets quantity 12 and amount 2000.00 while the monthly tariff is 200.00
- **THEN** the act SHALL store `quantity = 12`, `amount = 2000.00` as entered, and the PDF total SHALL render `2000.00` (the stored amount), without classification overriding it

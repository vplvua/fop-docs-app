# manual-acts Specification

## Purpose

Manual act creation — an admin path to create an act for money that did not arrive through the automatic PrivatBank classification flow (a different bank, or a pre-launch payment). The admin chooses the client, act period, service, quantity and amount; the system records a backing manual payment and reuses the existing numbering, snapshots, PDF and EDO pipeline. Covers FR-MACT-01..07.

## Requirements

### Requirement: Manual act creation form

The system SHALL provide an admin page «Створити акт вручну» that collects: a client (selectable only from active clients that have a contract), the act period (a month + year), a service type (`access` or `sms`), a quantity, and an amount. The page SHALL render dynamically so the eligible-client list reflects the database state at request time (never a build-time snapshot). The client selector SHALL be a searchable combobox that filters its options by a case-insensitive substring match over the client full name, the curated short name, the EDRPOU/РНОКПП (matched as text), and the contract number; it SHALL list only clients that have a contract and SHALL exclude archived clients (`auto_act_disabled = true`). Each option SHALL be labeled by the curated short name, falling back to «Договір №{number}», then to the EDRPOU alone; the full legal name SHALL NOT be displayed (it participates only in search). Options SHALL be ordered with short-named clients first (alphabetically), then the rest. On selecting a client and service the system SHALL pre-fill the unit price from the effective tariff (`resolveAccessPrice` / `resolveSmsPrice`) and a default quantity as a hint; the admin SHALL be able to override quantity and amount. The form SHALL be server-validated (Zod) before any act is created.

Covers: FR-MACT-01, FR-MACT-02.

#### Scenario: Client picker excludes contractless clients

- **WHEN** the admin opens the manual act form
- **THEN** the client selector SHALL list only clients that have a contract, because the PDF requires `contract_snapshot`

#### Scenario: Client picker excludes archived clients

- **WHEN** several clients share an EDRPOU and some of them are archived (`auto_act_disabled = true`)
- **THEN** the client selector SHALL list only the non-archived ones, so junk MoeOSBB duplicates cannot shadow the real client

#### Scenario: Client list is fresh on every load

- **WHEN** a client is created, renamed, or archived after the application was last deployed
- **THEN** the next load of the manual act form SHALL reflect that change (the page is rendered per request, not prerendered at build time)

#### Scenario: Client picker is searchable by names, EDRPOU and contract number

- **WHEN** the admin types a query into the client picker's search box
- **THEN** the picker SHALL show only clients whose full name, short name, EDRPOU/РНОКПП, or contract number contains that query as a case-insensitive substring, and selecting a result SHALL set it as the chosen client

#### Scenario: Option label falls back when the short name is empty

- **WHEN** a listed client has no curated short name
- **THEN** its option SHALL be labeled «Договір №{number} ({EDRPOU})» — and by the EDRPOU alone if the contract number is also unavailable — never by the full legal name

#### Scenario: Tariff pre-fills price as an overridable hint

- **WHEN** the admin selects a client and the `access` service
- **THEN** the unit price SHALL be pre-filled from the effective access tariff for that client and the amount SHALL be computed from price × quantity, while remaining editable

#### Scenario: Invalid input rejected

- **WHEN** the admin submits with a missing service, non-positive quantity, or non-positive amount
- **THEN** the server SHALL reject the submission and SHALL NOT create a payment or act

### Requirement: Act period decoupled from payment date

The manual act's `act_date` SHALL be the last day of the admin-chosen period month, independent of the backing payment's `payment_date`. The system SHALL NOT derive the period from the payment date for manual acts.

Covers: FR-MACT-03.

#### Scenario: Period chosen independently

- **WHEN** the admin chooses period December 2025 while recording a payment dated 2026-01-10
- **THEN** the act `act_date` SHALL be `2025-12-31` and the act number SHALL be derived from December 2025

### Requirement: Manual act is backed by a manual payment

Creating a manual act SHALL first create a backing `payments` row with `source = 'manual_external'`, a synthetic unique `bank_transaction_id` of the form `manual:{uuid}`, the admin-supplied amount, a `payment_date`, an optional `bank_label`, and `payer` fields populated from the selected client. The created act SHALL reference this payment via `payment_id` (the act-always-has-a-payment invariant), and the payment SHALL be left as `status = 'classified'` with `act_id` set to the new act — mirroring the state automatic classification produces. The synthetic id SHALL never collide with a PrivatBank `REF+REFN` id.

Covers: FR-MACT-04, FR-MACT-05.

#### Scenario: Backing payment created and linked

- **WHEN** the admin creates a manual act for client X, amount 200.00
- **THEN** a `payments` row SHALL exist with `source = 'manual_external'`, `bank_transaction_id` matching `manual:{uuid}`, `status = 'classified'`, `act_id` = the new act, and the act `payment_id` SHALL reference that payment

#### Scenario: Synthetic id does not collide with PrivatBank ids

- **WHEN** a manual payment id is generated
- **THEN** it SHALL be prefixed `manual:` so it cannot equal any PrivatBank `REF+REFN` value, and the unique constraint on `bank_transaction_id` SHALL hold across both sources

### Requirement: Manual act reuses numbering, snapshots, PDF and EDO pipeline

The manual act creation path SHALL assemble the act stub from the admin inputs (client/contract/FOP snapshots, service description, unit price, quantity, amount, `billing_period = monthly`) and SHALL reuse the existing race-safe per-client/month numbering (`SELECT ... FOR UPDATE`), the current FOP-requisites snapshot, PDF generation/storage in Blob, and the DubiDoc send. It SHALL NOT re-derive service/quantity/amount through automatic classification.

Covers: FR-MACT-06, FR-MACT-07.

#### Scenario: Number, snapshots and PDF produced

- **WHEN** a manual act is created for a client with an existing act `12/2025` in that month
- **THEN** the new act SHALL be numbered `12/2025/2`, carry client/contract/FOP snapshots, and have a PDF generated and stored in Blob

#### Scenario: Sent to DubiDoc for signing

- **WHEN** a manual act is created for a client whose `edo_provider = dubidoc` and PDF generation succeeds
- **THEN** the act SHALL be sent to DubiDoc via the existing send path and transition to `sent_to_edo`

#### Scenario: Amounts taken from admin input, not recomputed

- **WHEN** the admin sets quantity 12 and amount 2000.00 while the monthly tariff is 200.00
- **THEN** the act SHALL store `quantity = 12`, `amount = 2000.00` as entered, and the PDF total SHALL render `2000.00` (the stored amount), without classification overriding it

### Requirement: Edit a manual act's value fields

The system SHALL allow an admin to edit a manual act — one whose backing payment
has `source = 'manual_external'` — while it is mutable, i.e. its `status =
'draft'` OR its `edo_provider = 'vchasno_external'`. The editable fields SHALL be
the value fields offered at creation: `service_type`, `quantity`, `unit_price`,
`amount`, `bank_label` and `payment_date` (plus the already-editable service
description). The act's **client and period SHALL NOT be editable**, because they
determine the act number and the client/contract/FOP snapshots. The form SHALL be
server-validated (Zod) and the act and its backing payment SHALL be updated
together in one transaction so the act's `amount` and the payment's `amount` stay
in sync; the PDF SHALL be regenerated after the update.

The system SHALL reject an edit for a non-manual (automatic) act, and for a manual
act that is no longer mutable (`sent_to_edo`, or a signed DubiDoc act), without
modifying the act or its payment.

Covers: FR-MACT-08.

#### Scenario: Editing value fields updates act, payment and PDF

- **WHEN** an admin edits a `draft` manual act, changing quantity from 1 to 12 and amount from 500.00 to 2000.00
- **THEN** the act SHALL store `quantity = 12` and `amount = 2000.00`, the backing payment's `amount` SHALL also become `2000.00`, and the PDF SHALL be regenerated to render `2000.00`

#### Scenario: Client and period are not editable

- **WHEN** the edit form is shown for a manual act
- **THEN** the client and the act period SHALL be presented read-only and SHALL NOT be changed by the edit action, so the act number and snapshots remain stable

#### Scenario: Edit rejected for a non-manual act

- **WHEN** an edit is attempted on an act whose backing payment `source = 'privatbank'`
- **THEN** the system SHALL reject the edit and SHALL NOT modify the act or any payment

#### Scenario: Edit rejected once the act has left for DubiDoc

- **WHEN** an edit is attempted on a manual act with `status = 'sent_to_edo'` (dubidoc) or a signed DubiDoc act
- **THEN** the system SHALL reject the edit with a clear message, because the DubiDoc document cannot be amended through the API

#### Scenario: Vchasno manual act stays editable

- **WHEN** an admin edits a manual act whose `edo_provider = 'vchasno_external'`
- **THEN** the edit SHALL be allowed regardless of the act status, and no external document SHALL be involved

### Requirement: Delete a manual act

The system SHALL allow an admin to permanently delete a manual act (backing
payment `source = 'manual_external'`) while it is mutable, i.e. `status =
'draft'` OR `edo_provider = 'vchasno_external'`. The deletion SHALL remove the act
row and its synthetic backing payment row in one transaction, leaving no orphaned
`classified` payment. After deletion the act number `MM/YYYY[/N]` SHALL be free for
reuse so a corrected act can be created in its place.

The system SHALL reject deletion for a non-manual (automatic) act, and for a
manual act that is no longer mutable (`sent_to_edo`, or a signed DubiDoc act).

Covers: FR-MACT-09.

#### Scenario: Deletion removes act and backing payment

- **WHEN** an admin deletes a `draft` manual act backed by a `manual_external` payment
- **THEN** both the act row and that payment row SHALL be gone, and no payment with `act_id` pointing at the deleted act SHALL remain

#### Scenario: Act number freed for reuse

- **WHEN** the only act in period 05/2026 for a client is deleted
- **THEN** a newly created manual act for that client and period SHALL be numbered `05/2026` again, reusing the freed number

#### Scenario: Deletion rejected for a non-manual act

- **WHEN** deletion is attempted on an act whose backing payment `source = 'privatbank'`
- **THEN** the system SHALL reject the deletion and SHALL NOT remove the act or its payment

#### Scenario: Deletion rejected once the act has left for DubiDoc

- **WHEN** deletion is attempted on a manual act with `status = 'sent_to_edo'` (dubidoc) or a signed DubiDoc act
- **THEN** the system SHALL reject the deletion with a clear message

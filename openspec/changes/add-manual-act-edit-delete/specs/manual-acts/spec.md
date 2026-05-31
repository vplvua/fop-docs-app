# manual-acts Specification

## ADDED Requirements

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

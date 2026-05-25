## MODIFIED Requirements

### Requirement: Payment detail card

The system SHALL provide a `/payments/[id]` page showing all payment fields and a collapsible `raw_data` JSON viewer. The card SHALL display the status badge prominently. The card SHALL also display a classification action panel with context-dependent controls: "Класифікувати" and "Пропустити" buttons for actionable statuses (`received`, `awaiting_review`, `in_queue`); classification reason details for `in_queue`/`awaiting_review`; a link to the created act for `classified`; a "Пропущено" badge for `skipped`.

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

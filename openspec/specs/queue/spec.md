# queue Specification

## Purpose

Queue triage surface — a `/queue` route with two status tabs (awaiting approval and classification problems) that groups unresolved payments by classification reason and offers per-reason inline resolution cards (link/create client, contract disambiguation, same-EDRPOU candidate selection, missing-field deep-links, amount/SMS mismatch context, external EDO handling), each re-running classification after correction, plus skip-to-terminal and a pending-count navigation entry. Covers FR-QUEUE-01..10.

## Requirements

### Requirement: Queue route with two status tabs

The system SHALL provide a `/queue` route with two tabs: **На апрув** showing payments with `status = awaiting_review`, and **Проблеми класифікації** showing payments with `status = in_queue`. The active tab SHALL be reflected in the URL (search param), default `awaiting_review`. Payments with `status` of `received`, `classified`, or `skipped` SHALL NOT appear in the queue.

Covers: FR-QUEUE-01.

#### Scenario: Default tab shows awaiting_review

- **WHEN** the admin opens `/queue` with no tab specified
- **THEN** the **На апрув** tab SHALL be active and SHALL list only payments with `status = awaiting_review`

#### Scenario: Switching to problems tab

- **WHEN** the admin selects the **Проблеми класифікації** tab
- **THEN** the list SHALL show only payments with `status = in_queue` and the URL SHALL reflect the active tab

#### Scenario: Resolved and terminal payments excluded

- **WHEN** a payment has `status = classified`, `received`, or `skipped`
- **THEN** it SHALL NOT appear in either queue tab

### Requirement: Grouping by classification reason

Within each tab, the system SHALL group payments by their `classification_reason` key, rendering one group section per reason with a heading and the count of payments in that group. Groups SHALL be ordered by a fixed actionability priority so the most directly resolvable reasons appear first.

Covers: FR-QUEUE-02.

#### Scenario: Payments grouped under their reason

- **WHEN** the `in_queue` tab contains payments with reasons `no_match` and `amount_mismatch`
- **THEN** the page SHALL render a separate group for `no_match` and for `amount_mismatch`, each with its own count

#### Scenario: Empty tab

- **WHEN** a tab has no payments in its status
- **THEN** the page SHALL show an empty-state message and no group sections

### Requirement: no_match resolution card

For payments with `classification_reason` containing `no_match`, the queue SHALL offer actions to link the payment to an existing client (search/autocomplete) and to create a new client. Linking SHALL invoke the existing link action with the chosen client; the same-EDRPOU/contract guardrail SHALL apply.

Covers: FR-QUEUE-03.

#### Scenario: Link to existing client from queue

- **WHEN** the admin selects an existing client for a `no_match` payment and confirms
- **THEN** the system SHALL link the payment to that client and re-run classification

#### Scenario: Create new client path

- **WHEN** the admin chooses "Створити нового клієнта" for a `no_match` payment
- **THEN** the system SHALL open the new-client form prefilled from the payer details

### Requirement: multiple_contracts resolution card

For payments with `classification_reason` containing `multiple_contracts`, the queue SHALL display the parsed contract numbers as a radio-select to help the admin disambiguate, alongside re-run and skip actions.

Covers: FR-QUEUE-04.

#### Scenario: Parsed contract numbers shown as radio options

- **WHEN** a payment has `multiple_contracts` with parsed numbers `["556770", "556771"]`
- **THEN** the card SHALL render `556770` and `556771` as selectable radio options

### Requirement: multiple_clients_same_edrpou resolution card

For payments with `classification_reason` containing `multiple_clients_same_edrpou`, the queue SHALL show a warning that several active clients share the payer EDRPOU and a selector listing only the active candidate clients (each with contract number and Моє ОСББ id). Archived clients SHALL NOT be listed. Selecting a candidate SHALL link the payment and continue classification. Legacy `ambiguous_client` payments SHALL be shown read-only without a live selector.

Covers: FR-QUEUE-05.

#### Scenario: Active candidates selectable

- **WHEN** a payment has `multiple_clients_same_edrpou` with two active candidate clients
- **THEN** the card SHALL list both active candidates and SHALL NOT list any archived client

#### Scenario: Selecting a candidate links and reclassifies

- **WHEN** the admin selects one active candidate
- **THEN** the payment SHALL be linked to that client and classification SHALL re-run

#### Scenario: Legacy ambiguous_client is read-only

- **WHEN** a historical payment has `classification_reason` containing `ambiguous_client`
- **THEN** the card SHALL render guidance read-only without an active candidate selector

### Requirement: client_incomplete resolution card

For payments with `classification_reason` containing `client_incomplete`, the queue SHALL display the list of missing required fields, each linking to the specific client or contract field to fix. The missing-field list SHALL be computed on the fly and SHALL match the classifier's completeness rule (required: `email`, `address`, `bank_name`, `bank_account`, contract; plus `apartments_count` for `service_type = access` without `access_price_override`).

Covers: FR-QUEUE-06.

#### Scenario: Missing fields listed with deep-links

- **WHEN** the matched client is missing `email` and `bank_account`
- **THEN** the card SHALL list `email` and `bank_account` as missing, each as a link to the relevant client field

#### Scenario: Missing apartments_count for access without override

- **WHEN** `service_type = access`, `access_price_override` is null, and `apartments_count` is null
- **THEN** the missing-field list SHALL include `apartments_count`

### Requirement: amount_mismatch and sms_quantity_mismatch resolution card

For payments with `classification_reason` containing `amount_mismatch` or `sms_quantity_mismatch`, the queue SHALL show the computed values (payment amount, resolved unit price, and the implied/parsed quantity) and offer re-run and skip actions so the admin can correct the underlying data and reclassify.

Covers: FR-QUEUE-07.

#### Scenario: amount_mismatch shows computed variants

- **WHEN** a payment has `amount_mismatch` with amount and resolved unit price
- **THEN** the card SHALL display the amount, the unit price, and the non-integer division result, with re-run and skip actions

#### Scenario: sms_quantity_mismatch shows parsed quantity context

- **WHEN** a payment has `sms_quantity_mismatch`
- **THEN** the card SHALL display the amount and SMS unit price context, with re-run and skip actions

### Requirement: external_edo resolution card

For payments with `classification_reason` containing `external_edo`, the queue SHALL mark the payment with a "Вчасно" badge and show a hint that the act must be handled through the manual Вчасно workflow.

Covers: FR-QUEUE-08.

#### Scenario: Вчасно badge and manual hint

- **WHEN** a payment has `external_edo`
- **THEN** the card SHALL show a "Вчасно" badge and a hint describing the manual workflow

### Requirement: Inline correction re-runs classification

After any inline correction in the queue (linking a client, selecting a candidate, or triggering re-run), the system SHALL re-run classification automatically and the payment SHALL move out of its current group when the new status differs.

Covers: FR-QUEUE-09.

#### Scenario: Payment leaves queue after successful resolution

- **WHEN** an inline correction causes classification to resolve the payment to `classified`
- **THEN** the payment SHALL no longer appear in the queue after refresh

### Requirement: Skip from queue sets terminal status

The queue SHALL offer a "Пропустити" action on each payment that sets `Payment.status = skipped` (terminal). A skipped payment SHALL leave the queue and SHALL NOT be reclassifiable from the queue.

Covers: FR-QUEUE-10.

#### Scenario: Skipping removes payment from queue

- **WHEN** the admin clicks "Пропустити" on a queued payment
- **THEN** the payment status SHALL become `skipped` and it SHALL no longer appear in either queue tab

### Requirement: Queue navigation with pending count

The shared top-bar SHALL include a "Черга" navigation entry linking to `/queue`, showing the total count of payments in `awaiting_review` or `in_queue`.

Covers: FR-QUEUE-01.

#### Scenario: Pending count reflects unresolved payments

- **WHEN** there are payments in `awaiting_review` and `in_queue`
- **THEN** the "Черга" nav entry SHALL show their combined count

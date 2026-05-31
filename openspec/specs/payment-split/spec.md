# payment-split Specification

## Purpose

Manual splitting of one real payment into several acts — an admin path for bundled or aggregated transfers that back more than a single act. The split is governed by the reconciliation invariant `Σ(act.amount) == payment.amount`, and it attaches every created act to the existing payment via `payment_id` without fabricating any new `payments` row. The action is reachable from `received`, `awaiting_review`, `in_queue`, and `skipped` payments, transitions the payment to `classified`, and can be wholesale cancelled while all linked acts are still `draft`. Covers D-042.

## Requirements

### Requirement: Split a payment into multiple acts

The system SHALL provide an admin action «Розділити на акти» on the payment detail page that lets the admin define one or more act lines for a single existing payment. Each line SHALL collect: a client (selectable only from clients that have a contract, via the searchable contract-only picker), a period (month + year), a service type (`access` or `sms`), a quantity, and an amount; the unit price SHALL be pre-filled from the effective tariff (`resolveAccessPrice` / `resolveSmsPrice`) as an overridable hint. On submit the system SHALL create one act per line, in a single transaction, with every act's `payment_id` set to the existing payment. The form SHALL be server-validated (Zod) before any act is created.

The per-line client SHALL NOT be constrained to the payer EDRPOU, so a bundle paying for two different clients (e.g. a transit/aggregated transfer) can be split across them.

Covers: FR-SPLIT-01, FR-SPLIT-02 (new).

#### Scenario: Bundle split into access + sms

- **WHEN** the admin splits a 6460.00 payment into line A (`access`, amount 1000.00) and line B (`sms`, quantity 3900, amount 5460.00)
- **THEN** two acts SHALL be created, both with `payment_id` = that payment, and the payment SHALL become `classified`

#### Scenario: Lines may target different clients

- **WHEN** the admin splits one transfer into a line for client X and a line for client Y, both having a contract
- **THEN** both acts SHALL be created and linked to the same payment, regardless of the payer EDRPOU on the payment

#### Scenario: Client picker excludes contractless clients

- **WHEN** the admin opens a split line's client picker
- **THEN** it SHALL list only clients that have a contract, because each act's PDF requires `contract_snapshot`

### Requirement: Split reconciliation equals the payment amount

The system SHALL require the sum of the split line amounts to equal the payment amount exactly, compared as `numeric(10,2)`. If `Σ(line.amount) ≠ payment.amount` the system SHALL reject the split and SHALL NOT create any act. The form SHALL show a running allocation indicator («Розподілено X / Y · Залишок Z») and SHALL disable submission until the sum matches.

Covers: FR-SPLIT-03 (new).

#### Scenario: Sum matches — split accepted

- **WHEN** the line amounts are 1000.00 and 5460.00 and the payment amount is 6460.00
- **THEN** the split SHALL be accepted and the acts created

#### Scenario: Sum does not match — split rejected

- **WHEN** the line amounts are 1000.00 and 5000.00 and the payment amount is 6460.00
- **THEN** the system SHALL reject the split, create no act, and leave the payment status unchanged

### Requirement: Split attaches acts to the existing payment without fabricating payments

The split SHALL NOT insert any new `payments` row. Each created act SHALL reference the existing payment via `payment_id`; the payment SHALL be left `status = 'classified'` with `act_id` set to the first created act as a denormalised pointer. The authoritative set of acts backing a payment SHALL be derived by reverse lookup (`acts WHERE payment_id = …`), and the payment detail page SHALL list all of them.

Covers: FR-SPLIT-04 (new).

#### Scenario: No new payment rows

- **WHEN** a payment is split into N acts
- **THEN** no `payments` row SHALL be created, exactly N `acts` rows SHALL reference the payment's id, and the payment's `act_id` SHALL equal the first of them

#### Scenario: Payment detail lists every linked act

- **WHEN** the admin views a payment that backs 2 acts
- **THEN** the page SHALL show both acts (with their amounts and the allocation summary), not a single act link

### Requirement: Split is available from received, queued, and skipped payments

The split action SHALL be available for payments in `received`, `awaiting_review`, `in_queue`, and `skipped`. Splitting SHALL transition the payment to `classified`. A `skipped` payment is therefore not permanently terminal — split is the path that resolves a previously skipped bundled payment.

Covers: FR-SPLIT-05 (new).

#### Scenario: Split a skipped payment

- **WHEN** the admin splits a payment with `status = 'skipped'` into matching act lines
- **THEN** the acts SHALL be created and the payment SHALL transition to `classified`

#### Scenario: Split unavailable for an already-classified payment

- **WHEN** the admin views a payment with `status = 'classified'`
- **THEN** the split action SHALL NOT be offered (the split must be cancelled first to re-split)

### Requirement: Each split act reuses numbering, snapshots, PDF and EDO

Each split line SHALL be assembled into a full act via the existing race-safe per-client/month numbering (`SELECT … FOR UPDATE`), client/contract/FOP snapshots, `amount` stored as entered, `billing_period = monthly`, `act_date = lastDayOfMonth(line period)`. After the transaction commits, the system SHALL generate and store each act's PDF and send it through the existing EDO pipeline, exactly as automatic and manual act creation do. A PDF/EDO failure SHALL leave that act `draft` with `pdf_file_url = NULL` without rolling back the split.

Covers: FR-SPLIT-06 (new).

#### Scenario: Numbering across lines for the same client/month

- **WHEN** a split creates two acts for the same client in the same month with no prior act
- **THEN** they SHALL be numbered `MM/YYYY` and `MM/YYYY/2`, each carrying client/contract/FOP snapshots and a generated PDF

#### Scenario: Per-line period decoupled from payment date

- **WHEN** a line chooses period December 2025 while the payment is dated 2026-01-10
- **THEN** that act's `act_date` SHALL be `2025-12-31` and its number SHALL be derived from December 2025

### Requirement: Cancel a split

The system SHALL provide a «Скасувати розділення» action for a split-backed payment, available only while every act linked to the payment is `draft`. Cancelling SHALL delete all of the payment's linked acts and restore the payment to its pre-split status (the status it held before the split — `skipped` if it was skipped, otherwise `received`). The action SHALL be blocked if any linked act is `sent_to_edo` or `signed`.

Covers: FR-SPLIT-07 (new).

#### Scenario: Cancel restores the prior status

- **WHEN** the admin cancels a split on a payment whose acts are all `draft` and which was `skipped` before the split
- **THEN** all linked acts SHALL be deleted and the payment SHALL return to `status = 'skipped'`

#### Scenario: Cancel blocked after EDO send

- **WHEN** one of the split's acts has `status = 'sent_to_edo'`
- **THEN** the cancel action SHALL be blocked with a message that an issued act exists

#### Scenario: Split acts are not edited or deleted individually

- **WHEN** the admin opens an act that is part of a split (backed by a non-`manual_external` payment)
- **THEN** the per-act manual edit/delete actions SHALL NOT be available, and changing the split SHALL require cancelling and re-splitting

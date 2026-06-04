## MODIFIED Requirements

### Requirement: Split a payment into multiple acts

The system SHALL provide an admin action «Розділити на акти» on the payment detail page that lets the admin define one or more act lines for a single existing payment. Each line SHALL collect: a client (selectable only from clients that have a contract, via the searchable contract-only picker), a period (month + year), a service type (`access` or `sms`), a quantity, and an amount; the unit price SHALL be pre-filled from the effective tariff (`resolveAccessPrice` / `resolveSmsPrice`) as an overridable hint. On submit the system SHALL create one act per line, in a single transaction, with every act's `payment_id` set to the existing payment. The form SHALL be server-validated (Zod) before any act is created.

The per-line client SHALL be constrained to the payment's payer EDRPOU (`payments.payer_legal_id`): the eligible client list SHALL contain only contract-bearing clients whose `legal_id` equals the payer EDRPOU, and the server SHALL reject any line whose client's `legal_id` differs from the payer EDRPOU. When exactly one such client exists the form SHALL fix every line to it and SHALL NOT render a per-line client picker (the payer is shown read-only); when the payer EDRPOU maps to more than one contract-bearing client the picker SHALL be retained, scoped to those same-EDRPOU clients.

A transit/aggregated payer is the sole exception (D-008/D-027): when the payer EDRPOU is in the configured transit list (`transit_edrpou_list`) it belongs to an intermediary bank and cannot identify the client, so the system SHALL retain the full contract-only client picker per line, SHALL allow lines targeting different clients, and SHALL NOT apply the payer-EDRPOU guard.

Covers: FR-SPLIT-01, FR-SPLIT-02 (revised).

#### Scenario: Bundle split into access + sms for the same payer

- **WHEN** the admin splits a 600.00 payment from payer EDRPOU 26206408 into line A (`access`, amount 360.00) and line B (`sms`, amount 240.00)
- **THEN** two acts SHALL be created for the client whose `legal_id` is 26206408, both with `payment_id` = that payment, and the payment SHALL become `classified`

#### Scenario: Single payer client — no per-line picker

- **WHEN** the payer EDRPOU maps to exactly one contract-bearing client
- **THEN** the split form SHALL fix every line to that client and SHALL NOT show a client picker, displaying the payer read-only

#### Scenario: Server rejects an act for a different payer

- **WHEN** a submitted split line references a client whose `legal_id` differs from the payment's payer EDRPOU, and the payer EDRPOU is not in `transit_edrpou_list`
- **THEN** the system SHALL reject the split, create no act, and leave the payment status unchanged

#### Scenario: Transit payer may target different clients

- **WHEN** the payment's payer EDRPOU is in `transit_edrpou_list` and the admin splits it into a line for client X and a line for client Y, both having a contract
- **THEN** both acts SHALL be created and linked to the same payment, regardless of the payer EDRPOU on the payment

#### Scenario: Client picker excludes contractless clients

- **WHEN** the admin opens a split line's client picker (a transit payer, or a payer whose EDRPOU has several contracts)
- **THEN** it SHALL list only clients that have a contract, because each act's PDF requires `contract_snapshot`

#### Scenario: Non-transit payer with no contract client

- **WHEN** a payer EDRPOU that is not in `transit_edrpou_list` has no contract-bearing client
- **THEN** the split form SHALL show an empty state naming the payer and SHALL NOT offer act lines

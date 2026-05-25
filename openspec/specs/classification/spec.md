# classification Specification

## Purpose

Payment classification pipeline — automatic and manual classification of bank payments to clients/contracts, 8 classification reasons with queue routing, act stub generation on success. Covers FR-CLASS-01..18, FR-EDGE-03.

## Requirements

### Requirement: Classification triggers on received payments and manual reclassify

The system SHALL run classification on every payment with `status = received` immediately after ingest. The system SHALL also allow re-running classification on payments with `status = awaiting_review` or `status = in_queue` via a server action. Payments with `status = classified` SHALL NOT be reclassifiable (FR-CLASS-17).

Covers: FR-CLASS-01.

#### Scenario: Auto-classify after ingest

- **WHEN** a new payment is inserted with `status = received` during PrivatBank polling
- **THEN** the classifier SHALL run automatically and update the payment status to one of: `classified`, `awaiting_review`, or `in_queue`

#### Scenario: Manual reclassify from in_queue

- **WHEN** the admin triggers reclassification on a payment with `status = in_queue`
- **THEN** the classifier SHALL re-run and the payment status SHALL be updated based on current data

#### Scenario: Reclassify blocked for classified payment

- **WHEN** a payment has `status = classified`
- **THEN** the classify action SHALL NOT be available and the server action SHALL reject the request

### Requirement: Classification pipeline follows 8-step order

The classifier SHALL execute steps in order: (1) parse contract numbers from purpose, (2) dedup + multiple_contracts check, (3) client matching, (4) auto_act_disabled check, (5) edo_provider check, (6) service_type detection, (7) client data completeness check, (8) price resolve + quantity calculation. The entire classification SHALL run inside a Postgres transaction with `SELECT ... FOR UPDATE` on the payment row.

Covers: FR-CLASS-02, FR-CLASS-15.

#### Scenario: Happy path — all steps succeed

- **WHEN** a payment matches a client with a valid contract, complete data, and correct amount
- **THEN** the payment SHALL transition to `status = classified` with `act_id` pointing to a new act stub, and `service_type`, `unit_price`, `quantity`, `quantity_unit` SHALL be populated

#### Scenario: Concurrent classification is serialized

- **WHEN** two classification attempts run simultaneously for the same payment
- **THEN** the second attempt SHALL wait for the first transaction to complete (via `FOR UPDATE`), and SHALL see the updated status

### Requirement: Contract number parsing from purpose

The classifier SHALL apply all regex patterns from `Settings.contract_regex_patterns` to the payment's `purpose` field. Matched contract numbers SHALL be deduplicated by value and stored in `payment.parsed_contract_numbers`.

Covers: FR-CLASS-03.

#### Scenario: Single contract number matched

- **WHEN** purpose is `"Оплата по договір №556770"` and a regex captures `556770`
- **THEN** `parsed_contract_numbers` SHALL be `["556770"]`

#### Scenario: Multiple patterns match same number

- **WHEN** two different regex patterns both capture `556770` from the purpose
- **THEN** `parsed_contract_numbers` SHALL be `["556770"]` (deduplicated)

#### Scenario: No patterns match

- **WHEN** no regex pattern matches the purpose text
- **THEN** `parsed_contract_numbers` SHALL be an empty array, and the classifier SHALL proceed to fallback client matching by `payer_legal_id`

### Requirement: Multiple contracts detection

The classifier SHALL detect when more than one distinct contract number is found. The payment SHALL be routed to `status = in_queue` with `classification_reason = multiple_contracts`.

Covers: FR-CLASS-04.

#### Scenario: Two different contract numbers found

- **WHEN** regex parsing yields `["556770", "556771"]` from the purpose
- **THEN** payment SHALL have `status = in_queue`, `classification_reason` containing `multiple_contracts`

### Requirement: Client matching — two-factor verification

The classifier SHALL match a client using two factors: (1) contract number matches `contracts.number`, AND (2) `client.legal_id` matches `payment.payer_legal_id`. If contract matches but legal_id does not — `in_queue(ambiguous_client)`. If no contract match — fallback to `payer_legal_id` only. If no match at all — `in_queue(no_match)`.

Covers: FR-CLASS-05, FR-CLASS-07.

#### Scenario: Contract + legal_id match

- **WHEN** contract number `556770` exists for client with `legal_id = "12345678"` and `payer_legal_id = "12345678"`
- **THEN** the client SHALL be matched successfully

#### Scenario: Contract matches but legal_id differs

- **WHEN** contract number `556770` exists for client with `legal_id = "12345678"` but `payer_legal_id = "99999999"`
- **THEN** payment SHALL have `status = in_queue`, `classification_reason` containing `ambiguous_client`

#### Scenario: No contract match, fallback to legal_id

- **WHEN** no contract matches parsed numbers, but a client exists with `legal_id = payer_legal_id`
- **THEN** that client SHALL be matched via fallback

#### Scenario: No match at all

- **WHEN** no contract matches and no client has matching `legal_id`
- **THEN** payment SHALL have `status = in_queue`, `classification_reason` containing `no_match`

### Requirement: Transit EDRPOU bypass

For payments where `payer_legal_id` is in `Settings.transit_edrpou_list`, client matching SHALL use only contract number, without verifying `legal_id`.

Covers: FR-CLASS-06.

#### Scenario: Transit payment matched by contract only

- **WHEN** `payer_legal_id = "14360570"` (in transit list) and contract number `556770` matches a client
- **THEN** the client SHALL be matched regardless of the client's `legal_id`

#### Scenario: Transit payment with no contract match

- **WHEN** `payer_legal_id = "14360570"` (in transit list) but no contract matches
- **THEN** payment SHALL have `status = in_queue`, `classification_reason` containing `no_match`

### Requirement: Auto-act disabled check

If the matched client has `auto_act_disabled = true`, the payment SHALL be routed to `status = awaiting_review` with `classification_reason` containing `auto_act_disabled`. The act SHALL NOT be auto-generated.

Covers: FR-CLASS-08.

#### Scenario: Client with auto_act_disabled

- **WHEN** the matched client has `auto_act_disabled = true`
- **THEN** payment SHALL have `status = awaiting_review`, `classification_reason` containing `auto_act_disabled`

### Requirement: External EDO provider check

If the matched client has `edo_provider = vchasno_external`, the payment SHALL be routed to `status = awaiting_review` with `classification_reason` containing `external_edo`. When both `auto_act_disabled = true` and `edo_provider = vchasno_external`, `auto_act_disabled` takes priority.

Covers: FR-CLASS-09, FR-CLASS-10.

#### Scenario: Client with vchasno_external

- **WHEN** the matched client has `edo_provider = vchasno_external` and `auto_act_disabled = false`
- **THEN** payment SHALL have `status = awaiting_review`, `classification_reason` containing `external_edo`

#### Scenario: Both auto_act_disabled and vchasno_external

- **WHEN** the matched client has `auto_act_disabled = true` and `edo_provider = vchasno_external`
- **THEN** `classification_reason` SHALL contain `auto_act_disabled` (not `external_edo`)

### Requirement: Service type detection

The classifier SHALL determine `service_type` by checking if `purpose.toLowerCase()` contains any keyword from `Settings.sms_keywords`. If yes — `sms`; otherwise — `access`. The value `other` SHALL only be assigned manually.

Covers: FR-CLASS-11.

#### Scenario: SMS keyword detected

- **WHEN** purpose contains "смс" and `sms_keywords` includes "смс"
- **THEN** `service_type` SHALL be `sms`

#### Scenario: No SMS keyword — defaults to access

- **WHEN** purpose does not contain any keyword from `sms_keywords`
- **THEN** `service_type` SHALL be `access`

### Requirement: Client data completeness check

Before price resolution, the classifier SHALL verify the matched client has all required fields for act generation: `email`, `address`, `bank_name`, `bank_account`, and a contract. For `service_type = access` without `access_price_override`, `apartments_count` SHALL also be required. Missing fields SHALL route to `in_queue(client_incomplete)`.

Covers: FR-CLASS-12.

#### Scenario: Client missing email and bank_name

- **WHEN** the matched client has no `email` and no `bank_name`
- **THEN** payment SHALL have `status = in_queue`, `classification_reason` containing `client_incomplete`

#### Scenario: Access service without apartments_count and no override

- **WHEN** `service_type = access`, `apartments_count` is null, and `access_price_override` is null
- **THEN** payment SHALL have `status = in_queue`, `classification_reason` containing `client_incomplete`

#### Scenario: Access service without apartments_count but with override

- **WHEN** `service_type = access`, `apartments_count` is null, but `access_price_override` is set
- **THEN** completeness check SHALL pass (apartments_count not needed when override is set)

### Requirement: Access price and quantity validation

For `service_type = access`: the classifier SHALL resolve `unit_price` via the tariff resolver. If `payment.amount % unit_price != 0`, the payment SHALL route to `in_queue(amount_mismatch)`. Otherwise, `quantity = amount / unit_price` and `quantity_unit = "міс."`.

Covers: FR-CLASS-13.

#### Scenario: Amount evenly divisible by unit price

- **WHEN** `amount = 600.00` and `unit_price = 200.00`
- **THEN** `quantity` SHALL be `3`, `quantity_unit` SHALL be `"міс."`

#### Scenario: Amount not divisible

- **WHEN** `amount = 550.00` and `unit_price = 200.00`
- **THEN** payment SHALL have `status = in_queue`, `classification_reason` containing `amount_mismatch`

### Requirement: SMS price and quantity validation

For `service_type = sms`: the classifier SHALL parse quantity from `purpose` text and resolve `unit_price` via `resolveSmsPrice`. If quantity cannot be parsed, or if `parsed_quantity × unit_price != amount`, the payment SHALL route to `in_queue(sms_quantity_mismatch)`. `quantity_unit` SHALL be `"шт."`.

Covers: FR-CLASS-14.

#### Scenario: SMS quantity parsed and validated

- **WHEN** purpose contains "у кількості 100", `sms_unit_price = 1.40`, and `amount = 140.00`
- **THEN** `quantity` SHALL be `100`, `quantity_unit` SHALL be `"шт."`, `unit_price` SHALL be `1.40`

#### Scenario: SMS quantity not parseable

- **WHEN** purpose does not contain a recognizable quantity pattern
- **THEN** payment SHALL have `status = in_queue`, `classification_reason` containing `sms_quantity_mismatch`

#### Scenario: SMS quantity × price does not match amount

- **WHEN** parsed quantity is `100`, `sms_unit_price = 1.40`, but `amount = 150.00`
- **THEN** payment SHALL have `status = in_queue`, `classification_reason` containing `sms_quantity_mismatch`

### Requirement: Successful classification creates act stub

On successful classification, the system SHALL atomically (in the same transaction): set `payment.status = classified`, create an `acts` row with `status = draft`, snapshot fields (`client_snapshot`, `contract_snapshot`, `unit_price`, `quantity`, `quantity_unit`, `service_type`, `edo_provider`, `service_description`, `act_date`, `number`), and set `payment.act_id` to the new act's id.

Covers: FR-CLASS-16.

#### Scenario: Act stub created with snapshots

- **WHEN** classification succeeds for a client with `name = "ОСББ Тест"`, contract `number = "556770"`, `unit_price = 200.00`, `quantity = 1`
- **THEN** an act SHALL be created with `client_snapshot` containing `{name: "ОСББ Тест", ...}`, `contract_snapshot` containing `{number: "556770", ...}`, `status = draft`, and the payment's `act_id` SHALL reference it

#### Scenario: Act date is last day of payment month

- **WHEN** `payment_date = "2026-04-05"`
- **THEN** the act's `act_date` SHALL be `"2026-04-30"` (last day of April)

#### Scenario: Service description auto-generated

- **WHEN** `service_type = access` and `quantity = 3`, `quantity_unit = "міс."`
- **THEN** `service_description` SHALL be `"Доступ до сервісу за період 3 міс."`

- **WHEN** `service_type = sms` and `quantity = 100`, `quantity_unit = "шт."`
- **THEN** `service_description` SHALL be `"СМС-розсилка 100 шт."`

### Requirement: Skip payment action

The system SHALL provide a server action to mark a payment as `skipped`. This is a terminal state — no act SHALL be generated, and the payment SHALL NOT be reclassifiable.

Covers: FR-CLASS-18.

#### Scenario: Skip a payment

- **WHEN** the admin skips a payment with `status = in_queue`
- **THEN** `payment.status` SHALL be `skipped`

#### Scenario: Skip is terminal

- **WHEN** a payment has `status = skipped`
- **THEN** the classify action SHALL NOT be available

### Requirement: Price resolution uses payment_date

The classifier SHALL pass `payment_date` (not the current date or classification date) to the tariff resolver when resolving `unit_price`.

Covers: FR-EDGE-03.

#### Scenario: Payment from previous month uses that month's tariff

- **WHEN** a new tariff with `effective_from = 2026-05-01` exists, but `payment_date = 2026-04-15`
- **THEN** the classifier SHALL resolve the price using tariffs effective on `2026-04-15`, not `2026-05-01`

### Requirement: Acts table schema

The system SHALL create an `acts` table with: `id` (uuid PK), `client_id` (FK RESTRICT to clients), `payment_id` (uuid, FK to payments), `status` (enum: draft, sent_to_edo, signed, deleted), `service_type` (text), `unit_price` (numeric), `quantity` (numeric), `quantity_unit` (text), `act_date` (date), `number` (text), `client_snapshot` (jsonb), `contract_snapshot` (jsonb), `service_description` (text), `edo_provider` (edo_provider enum), `pdf_file_url` (text, nullable), `edo_doc_id` (text, nullable), `edo_status` (text, nullable), `sent_to_edo_at` (timestamp, nullable), `created_at`, `updated_at`. UNIQUE constraint on `(client_id, act_date, number)`. `payments.act_id` SHALL have FK to `acts.id` with ON DELETE SET NULL.

Covers: FR-ACT-01..04 (schema), TC-DB-06, TC-DB-07.

#### Scenario: Acts table exists with required constraints

- **WHEN** the migration is applied
- **THEN** the `acts` table SHALL exist with UNIQUE index on `(client_id, act_date, number)` and `payments.act_id` SHALL reference `acts.id`

### Requirement: Payment card shows classification actions

The payment detail page (`/payments/[id]`) SHALL display an action panel: for `received`/`awaiting_review`/`in_queue` — "Класифікувати" and "Пропустити" buttons; for `in_queue` — the classification reason with contextual guidance; for `classified` — a read-only link to the created act; for `skipped` — a "Пропущено" badge.

#### Scenario: Action panel for in_queue payment

- **WHEN** the admin views a payment with `status = in_queue` and `classification_reason` containing `no_match`
- **THEN** the page SHALL show "Класифікувати" and "Пропустити" buttons, and guidance text explaining the payment could not be matched to a client

#### Scenario: Action panel for classified payment

- **WHEN** the admin views a payment with `status = classified` and `act_id` set
- **THEN** the page SHALL show a read-only summary with a link to the act

## MODIFIED Requirements

### Requirement: Access price and quantity validation

For `service_type = access`: the classifier SHALL resolve `unit_price` via the tariff resolver, and SHALL let `N = annual_paid_months` (default 10) and `annual_price = unit_price × N`. Resolution proceeds in this order:

1. If the client has **no** `access_price_override` **and** `payment.amount == annual_price` → the payment is a one-shot yearly prepayment: `quantity = 12`, `quantity_unit = "міс."`, `billing_period = annual`.
2. Else if `payment.amount % unit_price == 0` **and** (the client has an `access_price_override` **or** `payment.amount / unit_price < N`) → `quantity = payment.amount / unit_price`, `quantity_unit = "міс."`, `billing_period = monthly`.
3. Otherwise → the payment SHALL route to `in_queue(amount_mismatch)`.

The annual branch SHALL take precedence over the monthly interpretation of the same amount (so `unit_price × N` is credited as a full year, not `N` months). Clients with an `access_price_override` SHALL never receive the yearly discount.

Covers: FR-CLASS-13.

#### Scenario: Amount evenly divisible by unit price (monthly)

- **WHEN** `amount = 600.00`, `unit_price = 200.00`, no override
- **THEN** `quantity` SHALL be `3`, `quantity_unit` SHALL be `"міс."`, `billing_period` SHALL be `monthly`

#### Scenario: One-shot yearly payment recognised

- **WHEN** `amount = 2000.00`, `unit_price = 200.00`, `annual_paid_months = 10`, no override
- **THEN** `quantity` SHALL be `12`, `billing_period` SHALL be `annual` (the annual price takes precedence over a 10-month reading)

#### Scenario: Amount above the annual price

- **WHEN** `amount = 2400.00`, `unit_price = 200.00`, `annual_paid_months = 10`, no override
- **THEN** the payment SHALL route to `in_queue(amount_mismatch)` (not 12 silent months)

#### Scenario: Override client excluded from the discount

- **WHEN** `amount = 2000.00` and `unit_price = 200.00` comes from `access_price_override`
- **THEN** `quantity` SHALL be `10`, `billing_period` SHALL be `monthly` (no yearly discount for override clients)

#### Scenario: Amount not divisible

- **WHEN** `amount = 550.00` and `unit_price = 200.00`
- **THEN** payment SHALL have `status = in_queue`, `classification_reason` containing `amount_mismatch`

### Requirement: Successful classification creates act stub

On successful classification, the system SHALL atomically (in the same transaction): set `payment.status = classified`, create an `acts` row with `status = draft`, snapshot fields (`client_snapshot`, `contract_snapshot`, `fop_snapshot`, `unit_price`, `quantity`, `quantity_unit`, `amount`, `billing_period`, `service_type`, `edo_provider`, `service_description`, `act_date`, `number`), and set `payment.act_id` to the new act's id. The `amount` SHALL be the payment amount (`payment.amount`) and `billing_period` SHALL be `monthly` or `annual` per the quantity resolution. The `fop_snapshot` SHALL be a copy of the current `fop_requisites` settings value. Act numbering SHALL use `SELECT ... FOR UPDATE` on acts for the same `(client_id, act_date)` to ensure race-safe number generation and SHALL produce the `MM/YYYY[/N]` format. The `service_description` SHALL be the configured service name for the `service_type` (from the `service_names` setting, falling back to the default wording when unset; no embedded quantity) and `quantity_unit` SHALL always be `шт.`. After the transaction commits, PDF generation SHALL be triggered asynchronously.

Covers: FR-CLASS-16, FR-ACT-01, FR-ACT-02, FR-ACT-03.

#### Scenario: Act stub created with snapshots

- **WHEN** classification succeeds for a client with `name = "ОСББ Тест"`, contract `number = "556770"`, `unit_price = 200.00`, `quantity = 1`
- **THEN** an act SHALL be created with `client_snapshot` containing `{name: "ОСББ Тест", ...}`, `contract_snapshot` containing `{number: "556770", ...}`, `fop_snapshot` containing the current requisites, `amount = 200.00`, `billing_period = monthly`, `status = draft`, and the payment's `act_id` SHALL reference it

#### Scenario: Annual act stub carries the paid amount

- **WHEN** classification succeeds for a yearly payment with `amount = 2000.00`, `unit_price = 200.00`, `quantity = 12`
- **THEN** the act SHALL have `amount = 2000.00`, `billing_period = annual`, `quantity = 12`, and `unit_price = 200.00`

#### Scenario: Act date is last day of payment month

- **WHEN** `payment_date = "2026-04-05"`
- **THEN** the act's `act_date` SHALL be `"2026-04-30"` (last day of April)

#### Scenario: Act number uses MM/YYYY format

- **WHEN** the act's `act_date` is in April 2026 and it is the first act for the client that month
- **THEN** the act's `number` SHALL be `04/2026`

#### Scenario: Service description uses the configured name

- **WHEN** `service_type = access`, `quantity = 12`, and `service_names.access = "Доступ до сервісу Моє ОСББ"`
- **THEN** `service_description` SHALL be `Доступ до сервісу Моє ОСББ`, `quantity_unit` SHALL be `шт.`, and the quantity SHALL render as the integer `12`

#### Scenario: Service description falls back to default wording

- **WHEN** `service_type = sms`, `quantity = 250`, and no `service_names` value is configured
- **THEN** `service_description` SHALL be the default `Інтернет послуги (розсилка повідомлень)`, `quantity_unit` SHALL be `шт.`, and the quantity SHALL render as the integer `250`

#### Scenario: Act numbering is race-safe

- **WHEN** two classifications create acts for the same client in the same month simultaneously
- **THEN** both acts SHALL have distinct numbers (serialized via `FOR UPDATE`)

### Requirement: Acts table schema

The system SHALL create an `acts` table with: `id` (uuid PK), `client_id` (FK RESTRICT to clients), `payment_id` (uuid, FK to payments), `status` (enum: draft, sent_to_edo, signed, deleted), `service_type` (text), `unit_price` (numeric), `quantity` (numeric), `quantity_unit` (text), `amount` (numeric, NOT NULL — the actual payment total), `billing_period` (enum: monthly, annual; NOT NULL, default monthly), `act_date` (date), `number` (text), `client_snapshot` (jsonb), `contract_snapshot` (jsonb), `service_description` (text), `edo_provider` (edo_provider enum), `pdf_file_url` (text, nullable), `edo_doc_id` (text, nullable), `edo_status` (text, nullable), `sent_to_edo_at` (timestamp, nullable), `created_at`, `updated_at`. UNIQUE constraint on `(client_id, act_date, number)`. `payments.act_id` SHALL have FK to `acts.id` with ON DELETE SET NULL. Existing rows SHALL be backfilled with `amount = unit_price × quantity` and `billing_period = monthly`.

Covers: FR-ACT-01..04 (schema), TC-DB-06, TC-DB-07.

#### Scenario: Acts table exists with required constraints

- **WHEN** the migration is applied
- **THEN** the `acts` table SHALL exist with UNIQUE index on `(client_id, act_date, number)`, an `amount` column and a `billing_period` column, and `payments.act_id` SHALL reference `acts.id`

#### Scenario: Existing acts backfilled

- **WHEN** the migration runs over an existing act with `unit_price = 200.00`, `quantity = 3`
- **THEN** the act SHALL have `amount = 600.00` and `billing_period = monthly`

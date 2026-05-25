## MODIFIED Requirements

### Requirement: Successful classification creates act stub

On successful classification, the system SHALL atomically (in the same transaction): set `payment.status = classified`, create an `acts` row with `status = draft`, snapshot fields (`client_snapshot`, `contract_snapshot`, `unit_price`, `quantity`, `quantity_unit`, `service_type`, `edo_provider`, `service_description`, `act_date`, `number`), and set `payment.act_id` to the new act's id. Act numbering SHALL use `SELECT ... FOR UPDATE` on acts for the same `(client_id, act_date)` to ensure race-safe number generation. After the transaction commits, PDF generation SHALL be triggered asynchronously.

Covers: FR-CLASS-16, FR-ACT-01, FR-ACT-02, FR-ACT-03.

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

#### Scenario: Act numbering is race-safe

- **WHEN** two classifications create acts for the same client in the same month simultaneously
- **THEN** both acts SHALL have distinct numbers (serialized via `FOR UPDATE`)

#### Scenario: PDF triggered after classification

- **WHEN** classification creates an act stub successfully
- **THEN** PDF generation SHALL be triggered asynchronously after the transaction commits

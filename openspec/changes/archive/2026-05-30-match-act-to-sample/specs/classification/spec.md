## MODIFIED Requirements

### Requirement: Successful classification creates act stub

On successful classification, the system SHALL atomically (in the same transaction): set `payment.status = classified`, create an `acts` row with `status = draft`, snapshot fields (`client_snapshot`, `contract_snapshot`, `fop_snapshot`, `unit_price`, `quantity`, `quantity_unit`, `service_type`, `edo_provider`, `service_description`, `act_date`, `number`), and set `payment.act_id` to the new act's id. The `fop_snapshot` SHALL be a copy of the current `fop_requisites` settings value. Act numbering SHALL use `SELECT ... FOR UPDATE` on acts for the same `(client_id, act_date)` to ensure race-safe number generation and SHALL produce the `MM/YYYY[/N]` format. The `service_description` SHALL be a fixed string per service type (not embedding the quantity) and `quantity_unit` SHALL always be `шт.`. After the transaction commits, PDF generation SHALL be triggered asynchronously.

Covers: FR-CLASS-16, FR-ACT-01, FR-ACT-02, FR-ACT-03.

#### Scenario: Act stub created with snapshots

- **WHEN** classification succeeds for a client with `name = "ОСББ Тест"`, contract `number = "556770"`, `unit_price = 200.00`, `quantity = 1`
- **THEN** an act SHALL be created with `client_snapshot` containing `{name: "ОСББ Тест", ...}`, `contract_snapshot` containing `{number: "556770", ...}`, `fop_snapshot` containing the current requisites, `status = draft`, and the payment's `act_id` SHALL reference it

#### Scenario: Act date is last day of payment month

- **WHEN** `payment_date = "2026-04-05"`
- **THEN** the act's `act_date` SHALL be `"2026-04-30"` (last day of April)

#### Scenario: Act number uses MM/YYYY format

- **WHEN** the act's `act_date` is in April 2026 and it is the first act for the client that month
- **THEN** the act's `number` SHALL be `04/2026`

#### Scenario: Service description is fixed text with «шт.» unit

- **WHEN** `service_type = access` and `quantity = 12`
- **THEN** `service_description` SHALL be `Надання доступу до сервісу "Моє ОСББ" (один календарний місяць)`, `quantity_unit` SHALL be `шт.`, and the quantity SHALL render as the integer `12`

- **WHEN** `service_type = sms` and `quantity = 250`
- **THEN** `service_description` SHALL be `Інтернет послуги (розсилка повідомлень)`, `quantity_unit` SHALL be `шт.`, and the quantity SHALL render as the integer `250`

#### Scenario: Act numbering is race-safe

- **WHEN** two classifications create acts for the same client in the same month simultaneously
- **THEN** both acts SHALL have distinct numbers (serialized via `FOR UPDATE`)

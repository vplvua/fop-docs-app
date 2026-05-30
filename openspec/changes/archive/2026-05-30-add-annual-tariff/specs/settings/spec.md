## ADDED Requirements

### Requirement: Admin can configure the annual prepay discount

The system SHALL let the admin configure the annual prepay discount as a single integer `annual_paid_months` (the number of monthly prices a one-shot yearly payment costs), stored in the `settings` table under key `annual_paid_months`. When the key is unset, the system SHALL fall back to the default `10`. The value SHALL be editable on the Тарифи page. For any access tariff, the annual price is computed as `unit_price × annual_paid_months`. The discount SHALL NOT apply to clients with an `access_price_override`.

#### Scenario: Default when unset

- **WHEN** no `annual_paid_months` value is stored
- **THEN** `getAnnualPaidMonths()` SHALL return `10`

#### Scenario: Edit the discount

- **WHEN** the admin sets "Оплачених місяців за рік" to `10` on the Тарифи page and submits
- **THEN** the `settings` row with key `annual_paid_months` SHALL be `10`, and a yearly payment for a 200.00 tariff SHALL be recognised at `200.00 × 10 = 2000.00`

#### Scenario: Invalid value rejected

- **WHEN** the admin submits a non-positive or non-integer value
- **THEN** the form SHALL reject it and the stored value SHALL be unchanged

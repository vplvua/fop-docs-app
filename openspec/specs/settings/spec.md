# settings Specification

## Purpose

Classifier configuration settings: regex patterns for contract number parsing, SMS keywords, transit EDRPOU list, polling/sync intervals. Generic KV store with typed accessors. Covers FR-SET-03 through FR-SET-07.

## Requirements

### Requirement: Admin can manage contract regex patterns

The system SHALL provide a `/settings/patterns` page where the admin can view, add, and remove regex patterns used for parsing contract numbers from payment purposes. Each pattern entry has `pattern` (regex string) and optional `description`. The page SHALL include a test-area where the admin can type a sample purpose string and see which patterns match and what groups they capture. The test-area runs client-side. Patterns that do not compile as valid JavaScript RegExp SHALL be rejected with an error.

Covers: FR-SET-03.

#### Scenario: View starter patterns

- **WHEN** the admin navigates to `/settings/patterns` on a fresh installation
- **THEN** the page SHALL display 5 seed regex patterns from the PRD starter set

#### Scenario: Add a new pattern

- **WHEN** the admin enters `/^Опл.*договір\s*[№#]\s*(\d{6})/i` with description "Оплата по договір" and submits
- **THEN** the pattern SHALL be added to the list and persisted in the `settings` table under key `contract_regex_patterns`

#### Scenario: Invalid regex rejected

- **WHEN** the admin enters `[invalid(` as a pattern
- **THEN** the form SHALL display an error: "Невалідний regex"

#### Scenario: Remove a pattern

- **WHEN** the admin clicks the remove button on a pattern
- **THEN** the pattern SHALL be removed from the list

#### Scenario: Test-area matches

- **WHEN** the admin types `"Оплата по договір №556770"` into the test-area and a pattern `/договір\s*[№#N]?\s*(\d{5,6})/i` exists
- **THEN** the test-area SHALL highlight the matching pattern and show captured group `"556770"`

### Requirement: Admin can manage SMS keywords

The system SHALL provide a `/settings/sms-keywords` page where the admin can view, add, and remove keywords used for detecting SMS service type. Keywords are stored as a string array in the `settings` table under key `sms_keywords`. Seed value: `["смс", "sms", "повідомлення"]`.

Covers: FR-SET-04.

#### Scenario: View seed keywords

- **WHEN** the admin navigates to `/settings/sms-keywords`
- **THEN** the page SHALL display `смс`, `sms`, `повідомлення` as the default keywords

#### Scenario: Add a keyword

- **WHEN** the admin types "розсилка" and clicks "Додати"
- **THEN** `"розсилка"` SHALL be added to the `sms_keywords` array

#### Scenario: Remove a keyword

- **WHEN** the admin clicks the remove button on "sms"
- **THEN** `"sms"` SHALL be removed from the `sms_keywords` array

### Requirement: Admin can manage transit EDRPOU list

The system SHALL provide a `/settings/transit-edrpou` page where the admin can view, add, and remove EDRPOU codes of transit bank accounts. Stored as a string array under key `transit_edrpou_list`. Seed value: `["14360570"]`. Each entry MUST be exactly 8 digits.

Covers: FR-SET-05.

#### Scenario: View seed EDRPOU

- **WHEN** the admin navigates to `/settings/transit-edrpou`
- **THEN** the page SHALL display `14360570`

#### Scenario: Add a valid EDRPOU

- **WHEN** the admin enters `"12345678"` and clicks "Додати"
- **THEN** `"12345678"` SHALL be added to the `transit_edrpou_list` array

#### Scenario: Invalid EDRPOU rejected

- **WHEN** the admin enters `"12345"` (5 digits)
- **THEN** the form SHALL display an error: "ЄДРПОУ має бути 8 цифр"

### Requirement: Admin can edit polling and sync intervals

The system SHALL provide a `/settings/integrations` page where the admin can view and edit: `privatbank_polling_interval_minutes` (integer, default 60), `dubidoc_poll_interval_hours` (integer, default 6), `moeosbb_sync_schedule` (enum: `first` / `last` / `manual`, default `first`). Changes are persisted immediately on form submission.

Covers: FR-SET-06.

#### Scenario: Edit PrivatBank polling interval

- **WHEN** the admin changes `privatbank_polling_interval_minutes` from 60 to 30 and submits
- **THEN** the setting SHALL be updated to 30

#### Scenario: Edit MoeOSBB sync schedule

- **WHEN** the admin changes `moeosbb_sync_schedule` from `first` to `manual`
- **THEN** the setting SHALL be updated to `"manual"`

### Requirement: Integration credentials are not displayed

The system SHALL NOT display credential values (`PRIVATBANK_TOKEN`, `DUBIDOC_TOKEN`, `MOEOSBB_DB_URL`) in the UI. The integrations page SHALL show only a connection status indicator per service. Until integration slices (S6/S9/S11) are built, the status SHALL display "Не налаштовано".

Covers: FR-SET-07.

#### Scenario: Credentials not visible

- **WHEN** the admin views `/settings/integrations`
- **THEN** no credential values, tokens, or database URLs SHALL be displayed

#### Scenario: Placeholder status before integration

- **WHEN** the admin views `/settings/integrations` before S6/S9/S11
- **THEN** each integration card SHALL show status "Не налаштовано"

### Requirement: Admin can edit service names

The system SHALL let the admin edit the act service-line names, stored in the `settings` table under key `service_names` as `{ access: string, sms: string }` (non-empty, trimmed). The access name SHALL be editable on the Тарифи page and the SMS/internet name on the Ціни СМС page. Saving one name SHALL merge into the `service_names` value without clobbering the other. When the key is unset or a field is missing, the system SHALL fall back to the default wording (`Надання доступу до сервісу "Моє ОСББ" (один календарний місяць)` for access, `Інтернет послуги (розсилка повідомлень)` for sms).

#### Scenario: Admin edits the access service name

- **WHEN** the admin changes the access service name on the Тарифи page and saves
- **THEN** `service_names.access` SHALL be persisted and `service_names.sms` SHALL be unchanged

#### Scenario: Admin edits the SMS service name

- **WHEN** the admin changes the SMS service name on the Ціни СМС page and saves
- **THEN** `service_names.sms` SHALL be persisted and `service_names.access` SHALL be unchanged

#### Scenario: Defaults when unset

- **WHEN** no `service_names` value has been saved
- **THEN** reading the service names SHALL return the default wording for both `access` and `sms`

#### Scenario: Empty name rejected

- **WHEN** the admin submits an empty service name
- **THEN** validation SHALL fail and the value SHALL NOT be persisted

### Requirement: Settings seed data

The system SHALL ship with seed data in the `settings` table: `contract_regex_patterns` (5 starter patterns), `sms_keywords` (`["смс", "sms", "повідомлення"]`), `transit_edrpou_list` (`["14360570"]`), `privatbank_polling_interval_minutes` (60), `dubidoc_poll_interval_hours` (6), `moeosbb_sync_schedule` (`"first"`).

Covers: FR-SET-03, FR-SET-04, FR-SET-05, FR-SET-06.

#### Scenario: Seed on fresh database

- **WHEN** the migration runs on an empty database
- **THEN** all 6 settings keys SHALL be present with their default values

#### Scenario: Seed is idempotent

- **WHEN** the seed migration runs again
- **THEN** no duplicate keys SHALL be created (ON CONFLICT DO NOTHING)

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

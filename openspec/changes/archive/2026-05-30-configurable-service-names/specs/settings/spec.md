## ADDED Requirements

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

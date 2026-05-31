## MODIFIED Requirements

### Requirement: Manual act creation form

The system SHALL provide an admin page «Створити акт вручну» that collects: a client (selectable only from clients that have a contract), the act period (a month + year), a service type (`access` or `sms`), a quantity, and an amount. The client selector SHALL be a searchable combobox that filters its options by a case-insensitive substring match over the client name, the EDRPOU/РНОКПП (matched as text), and the contract number; it SHALL still list only clients that have a contract. On selecting a client and service the system SHALL pre-fill the unit price from the effective tariff (`resolveAccessPrice` / `resolveSmsPrice`) and a default quantity as a hint; the admin SHALL be able to override quantity and amount. The form SHALL be server-validated (Zod) before any act is created.

Covers: FR-MACT-01, FR-MACT-02.

#### Scenario: Client picker excludes contractless clients

- **WHEN** the admin opens the manual act form
- **THEN** the client selector SHALL list only clients that have a contract, because the PDF requires `contract_snapshot`

#### Scenario: Client picker is searchable by name, EDRPOU and contract number

- **WHEN** the admin types a query into the client picker's search box
- **THEN** the picker SHALL show only clients whose name, EDRPOU/РНОКПП, or contract number contains that query as a case-insensitive substring, and selecting a result SHALL set it as the chosen client

#### Scenario: Tariff pre-fills price as an overridable hint

- **WHEN** the admin selects a client and the `access` service
- **THEN** the unit price SHALL be pre-filled from the effective access tariff for that client and the amount SHALL be computed from price × quantity, while remaining editable

#### Scenario: Invalid input rejected

- **WHEN** the admin submits with a missing service, non-positive quantity, or non-positive amount
- **THEN** the server SHALL reject the submission and SHALL NOT create a payment or act

## MODIFIED Requirements

### Requirement: Manual act creation form

The system SHALL provide an admin page «Створити акт вручну» that collects: a client (selectable only from active clients that have a contract), the act period (a month + year), a service type (`access` or `sms`), a quantity, and an amount. The page SHALL render dynamically so the eligible-client list reflects the database state at request time (never a build-time snapshot). The client selector SHALL be a searchable combobox that filters its options by a case-insensitive substring match over the client full name, the curated short name, the EDRPOU/РНОКПП (matched as text), and the contract number; it SHALL list only clients that have a contract and SHALL exclude archived clients (`auto_act_disabled = true`). Each option SHALL be labeled by the curated short name, falling back to «Договір №{number}», then to the EDRPOU alone; the full legal name SHALL NOT be displayed (it participates only in search). Options SHALL be ordered with short-named clients first (alphabetically), then the rest. On selecting a client and service the system SHALL pre-fill the unit price from the effective tariff (`resolveAccessPrice` / `resolveSmsPrice`) and a default quantity as a hint; the admin SHALL be able to override quantity and amount. The form SHALL be server-validated (Zod) before any act is created.

Covers: FR-MACT-01, FR-MACT-02.

#### Scenario: Client picker excludes contractless clients

- **WHEN** the admin opens the manual act form
- **THEN** the client selector SHALL list only clients that have a contract, because the PDF requires `contract_snapshot`

#### Scenario: Client picker excludes archived clients

- **WHEN** several clients share an EDRPOU and some of them are archived (`auto_act_disabled = true`)
- **THEN** the client selector SHALL list only the non-archived ones, so junk MoeOSBB duplicates cannot shadow the real client

#### Scenario: Client list is fresh on every load

- **WHEN** a client is created, renamed, or archived after the application was last deployed
- **THEN** the next load of the manual act form SHALL reflect that change (the page is rendered per request, not prerendered at build time)

#### Scenario: Client picker is searchable by names, EDRPOU and contract number

- **WHEN** the admin types a query into the client picker's search box
- **THEN** the picker SHALL show only clients whose full name, short name, EDRPOU/РНОКПП, or contract number contains that query as a case-insensitive substring, and selecting a result SHALL set it as the chosen client

#### Scenario: Option label falls back when the short name is empty

- **WHEN** a listed client has no curated short name
- **THEN** its option SHALL be labeled «Договір №{number} ({EDRPOU})» — and by the EDRPOU alone if the contract number is also unavailable — never by the full legal name

#### Scenario: Tariff pre-fills price as an overridable hint

- **WHEN** the admin selects a client and the `access` service
- **THEN** the unit price SHALL be pre-filled from the effective access tariff for that client and the amount SHALL be computed from price × quantity, while remaining editable

#### Scenario: Invalid input rejected

- **WHEN** the admin submits with a missing service, non-positive quantity, or non-positive amount
- **THEN** the server SHALL reject the submission and SHALL NOT create a payment or act

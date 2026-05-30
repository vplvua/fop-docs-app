## MODIFIED Requirements

### Requirement: Acts list page

The system SHALL provide an `/acts` page displaying acts in a table with columns: act_date, number, client name, service_type, status (badge), edo_provider, and amount. The amount column SHALL show the value thousands-separated with the currency unit in the column header (`Сума, ₴`); it SHALL NOT repeat the currency suffix in each cell.

The list SHALL support:

- **Status** filter (existing).
- **Service-type** filter — sms / access.
- **EDO provider** filter (existing).
- **Date-range** filter on `act_date` — presets (today / this & last week / this & last month / this & last quarter) plus a custom from/to range, default no date filter, per the `data-tables` date-range behavior.
- **Text search** by the current client, joining `acts.client_id → clients`: `clients.name` (case-insensitive substring) and `clients.moeosbb_user_id` (exact, when the query is all digits). This replaces the prior search on `service_description`.

Search and filters apply across the whole dataset and combine, with server-side pagination and sorting per `data-tables`.

Covers: FR-UI-06.

#### Scenario: View acts list

- **WHEN** the admin navigates to `/acts`
- **THEN** acts SHALL be displayed sorted by `act_date` descending, then `number` (page 1)

#### Scenario: Filter by status

- **WHEN** the admin selects status filter "draft"
- **THEN** only acts with `status = draft` SHALL be displayed

#### Scenario: Filter by service type

- **WHEN** the admin selects the service-type filter "access"
- **THEN** only acts with `service_type = 'access'` SHALL be displayed

#### Scenario: Filter by date range

- **WHEN** the admin selects the "Цей квартал" preset
- **THEN** only acts whose `act_date` falls in the current calendar quarter (Europe/Kyiv) SHALL be displayed

#### Scenario: Search by client name

- **WHEN** the admin searches a client-name fragment
- **THEN** acts whose linked client's name contains that fragment (case-insensitive) SHALL be displayed

#### Scenario: Search by MoeOSBB id

- **WHEN** the admin searches a MoeOSBB id
- **THEN** acts whose linked client has that `moeosbb_user_id` SHALL be displayed

#### Scenario: Amount column has no per-cell currency suffix

- **WHEN** the admin views the acts list
- **THEN** the amount SHALL be shown as a thousands-separated number with the unit in the header, without a "грн" suffix in each row

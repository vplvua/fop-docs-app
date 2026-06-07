## ADDED Requirements

### Requirement: Act client snapshot carries the short name

At act creation the immutable client snapshot SHALL capture the client's `short_name`
(as `shortName`, nullable) alongside the existing `name` and `legalId`. The frozen
`shortName` SHALL be used to compose the DubiDoc document title (see `edo-dubidoc`),
keeping the title consistent with the act as issued even if the client's short name later
changes.

Covers: BC-LEGAL-05.

#### Scenario: Snapshot freezes the short name

- **WHEN** an act is created for a client whose `short_name = "Молодіжний Новомосковськ"`
- **THEN** the act's `client_snapshot` SHALL contain `shortName = "Молодіжний Новомосковськ"`

#### Scenario: Snapshot freezes null when no short name

- **WHEN** an act is created for a client whose `short_name` is NULL
- **THEN** the act's `client_snapshot` SHALL contain `shortName = null`

## MODIFIED Requirements

### Requirement: Acts list page

The system SHALL provide an `/acts` page displaying acts in a table with columns: act_date, number, client name, the linked client's `moeosbb_user_id` (or "—" when the client has none), service_type, amount, edo_provider, and status (badge). The amount column SHALL show the value thousands-separated with the currency unit in the column header (`Сума, ₴`); it SHALL NOT repeat the currency suffix in each cell.

The client-name column ("Клієнт") SHALL show `displayClientName` of the **live** linked client (the short name when set, otherwise the full name), with the full name available as a hover tooltip. Because it reads the live client (joined via `acts.client_id → clients`), existing acts SHALL reflect the short name once the operator fills it; the DubiDoc title and PDF remain on the frozen snapshot.

The list SHALL support:

- **Status** filter (existing).
- **Service-type** filter — sms / access.
- **EDO provider** filter (existing).
- **Date-range** filter on `act_date` — presets (today / this & last week / this & last month / this & last quarter) plus a custom from/to range, default no date filter, per the `data-tables` date-range behavior.
- **Text search** by the current client, joining `acts.client_id → clients`: `clients.name` (case-insensitive substring) and `clients.moeosbb_user_id` (substring of the id cast to text, when the query is all digits). This replaces the prior search on `service_description`.

Search and filters apply across the whole dataset and combine, with server-side pagination and sorting per `data-tables`.

Covers: FR-UI-06.

#### Scenario: View acts list

- **WHEN** the admin navigates to `/acts`
- **THEN** acts SHALL be displayed sorted by `act_date` descending, then `number` (page 1)

#### Scenario: Client column shows the short name

- **WHEN** the admin views an act whose linked client has `short_name = "Молодіжний Новомосковськ"`
- **THEN** the "Клієнт" column SHALL show `"Молодіжний Новомосковськ"` with the full name as a hover tooltip, even for acts created before the short name was set

#### Scenario: Client column falls back to full name

- **WHEN** the admin views an act whose linked client has no `short_name`
- **THEN** the "Клієнт" column SHALL show the client's full `name`

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

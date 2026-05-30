## ADDED Requirements

### Requirement: Server-side pagination

The `/clients`, `/payments`, and `/acts` list surfaces SHALL paginate their rows server-side, driven by `page` and `perPage` URL search params. `perPage` SHALL offer **25**, **50**, and **100** rows per page, defaulting to **25**. The server SHALL fetch only the requested page (`LIMIT/OFFSET`) and SHALL compute the total record count over the active filter set so the footer can show the number of pages and total records. No list surface SHALL silently cap results (the prior 500-row limits are removed).

Pagination controls SHALL render in the surface's pinned footer slot and SHALL remain visible while the table body scrolls. Changing the page size SHALL reset to page 1. Changing a filter or search term SHALL reset to page 1.

Covers: FR-UI-06, FR-PAY-01, FR-CLI-09.

#### Scenario: Default page size

- **WHEN** the admin opens a list surface without a `perPage` param
- **THEN** at most 25 rows SHALL be shown and the footer SHALL offer 25 / 50 / 100 options

#### Scenario: Navigate to the next page

- **WHEN** the admin is on page 1 of a list with more rows than the page size and clicks "Далі"
- **THEN** the surface SHALL show the next slice of rows and the footer SHALL indicate page 2

#### Scenario: Total count reflects active filters

- **WHEN** a filter or search term is active
- **THEN** the total record count and page count in the footer SHALL reflect the filtered result set, not the whole table

#### Scenario: Changing page size returns to page 1

- **WHEN** the admin is on page 3 and changes the page size
- **THEN** the surface SHALL return to page 1 at the new page size

#### Scenario: No silent cap

- **WHEN** a surface has more than 500 matching rows
- **THEN** all matching rows SHALL be reachable via pagination (no hidden 500-row limit)

### Requirement: Column sorting

The `/clients`, `/payments`, and `/acts` list surfaces SHALL support user-controlled sorting on meaningful columns via clickable column headers, with an icon indicating the sort state (inactive / ascending / descending). Sort state SHALL be carried in the URL as `sort` (column key) and `dir` (`asc`/`desc`). Clicking the active sort column SHALL toggle direction; clicking another sortable column SHALL switch the sort to that column. Sort columns SHALL be validated against a fixed per-table allow-list (no arbitrary column from the client). Purely visual columns (status / EDO badges) SHALL NOT be sortable.

When no `sort` param is present, each surface SHALL apply its default sort: clients by `moeosbb_user_id` ascending with null ids last; payments by `payment_date` descending; acts by `act_date` descending then `number`.

Covers: FR-UI-06, FR-PAY-01, FR-CLI-09.

#### Scenario: Sort by a column ascending then descending

- **WHEN** the admin clicks a sortable column header, then clicks it again
- **THEN** the rows SHALL sort by that column ascending on the first click and descending on the second, with the header icon reflecting the direction

#### Scenario: Default sort on clients

- **WHEN** the admin opens `/clients` with no `sort` param
- **THEN** clients SHALL be ordered by `moeosbb_user_id` ascending, with clients that have no MoeOSBB id appearing last

#### Scenario: Default sort on payments and acts

- **WHEN** the admin opens `/payments` or `/acts` with no `sort` param
- **THEN** rows SHALL be ordered by date descending (newest first)

#### Scenario: Non-sortable column has no control

- **WHEN** the admin views a status or EDO badge column header
- **THEN** it SHALL NOT present a sort control

#### Scenario: Invalid sort key falls back to default

- **WHEN** a request carries a `sort` key outside the table's allow-list
- **THEN** the surface SHALL apply its default sort instead

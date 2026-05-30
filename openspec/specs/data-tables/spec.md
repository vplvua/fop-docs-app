# data-tables Specification

## Purpose

Cross-cutting behavior for the operator's list surfaces (`/clients`, `/payments`, `/acts`) — the fixed-viewport sticky shell (top-bar, page chrome, and table column header stay visible while only the table body scrolls, with a reserved sticky footer slot), full-row navigation, and table loading states. Later changes extend this capability with pagination, sorting, search, filters, and persistence. Covers FR-UI-01, FR-UI-06, FR-PAY-01, FR-CLI-09.

## Requirements

### Requirement: Fixed-viewport table layout

The operator list surfaces (`/clients`, `/payments`, `/acts`) SHALL render inside a fixed-viewport shell in which only the table body scrolls. The dashboard top-bar, the page chrome (heading, primary action button, and toolbar), the table column header (`<thead>`), and the page's bottom footer slot SHALL remain visible while the table body is scrolled. The document body itself SHALL NOT scroll.

The bottom footer slot SHALL be reserved on every list surface for the pagination control (filled by the pagination change); it SHALL remain pinned to the bottom of the surface and SHALL NOT scroll out of view.

Covers: FR-UI-01 (operator surfaces), FR-UI-06 (acts list), FR-PAY-01 (payments list), FR-CLI-09 (clients list).

#### Scenario: Column header stays visible while scrolling

- **WHEN** the admin scrolls a list whose rows exceed the viewport height
- **THEN** the table column header SHALL remain pinned at the top of the scroll region and the rows SHALL scroll underneath it

#### Scenario: Page chrome stays visible while scrolling

- **WHEN** the admin scrolls the table body on `/clients`, `/payments`, or `/acts`
- **THEN** the top-bar, page heading, primary action button, and toolbar SHALL remain visible and SHALL NOT scroll away

#### Scenario: Footer slot stays pinned

- **WHEN** the admin scrolls a long list
- **THEN** the bottom footer slot SHALL stay pinned to the bottom of the surface regardless of scroll position

### Requirement: Full-row navigation in data tables

Each row on the `/clients`, `/payments`, and `/acts` list surfaces SHALL be navigable by clicking anywhere on the row, which SHALL open that record's detail page. The row SHALL show a hover affordance indicating it is clickable. Row navigation SHALL be implemented with a real anchor so that middle-click and ⌘/Ctrl-click open the detail page in a new tab and keyboard focus + Enter works.

Covers: FR-UI-06, FR-PAY-01, FR-CLI-09.

#### Scenario: Click anywhere on a payment row

- **WHEN** the admin clicks any cell of a row on `/payments` (not only the date)
- **THEN** the browser SHALL navigate to that payment's detail page

#### Scenario: Click anywhere on an act row

- **WHEN** the admin clicks any cell of a row on `/acts` (not only the date)
- **THEN** the browser SHALL navigate to that act's detail page

#### Scenario: Open a row in a new tab

- **WHEN** the admin ⌘/Ctrl-clicks or middle-clicks a row on any list surface
- **THEN** the record's detail page SHALL open in a new browser tab

#### Scenario: Hover affordance

- **WHEN** the admin hovers a row on any list surface
- **THEN** the row SHALL show a hover highlight and a pointer cursor

### Requirement: Table loading states

Each list surface SHALL show a loading state while its data is being fetched, instead of a frozen or blank page. The loading state SHALL render the page's sticky chrome immediately and present a skeleton/placeholder table body, so that the layout does not reflow when data arrives.

Covers: FR-UI-01.

#### Scenario: Initial navigation shows a loader

- **WHEN** the admin navigates to `/clients`, `/payments`, or `/acts` and the data has not yet loaded
- **THEN** the page SHALL display the sticky chrome plus a skeleton table body until the rows are ready

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

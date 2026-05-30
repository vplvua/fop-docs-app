## ADDED Requirements

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

## ADDED Requirements

### Requirement: Debounced server-backed search

Search on the list surfaces SHALL query the full dataset under the active filters server-side, not filter an already-loaded page. Typing in the search box SHALL be debounced (~300 ms) before issuing a request, SHALL show a pending/loading indicator while results are being fetched, and SHALL reset pagination to page 1. Search SHALL combine with the active filters (it narrows the already-filtered set).

Covers: FR-CLI-09, FR-PAY-01, FR-UI-06.

#### Scenario: Search queries all records under filters

- **WHEN** a status filter is active and the admin types a search term
- **THEN** the results SHALL be the records across the whole dataset that match both the filter and the search term, not only those on the current page

#### Scenario: Debounce and loader

- **WHEN** the admin types several characters quickly
- **THEN** the surface SHALL issue the query after a short pause and SHALL show a loading indicator until results arrive

#### Scenario: Search resets to first page

- **WHEN** the admin is on page 3 and changes the search term
- **THEN** the surface SHALL return to page 1 of the new result set

### Requirement: Reusable date-range filter

Surfaces that filter by date (`/payments` on `payment_date`, `/acts` on `act_date`) SHALL provide a date-range filter offering presets — Сьогодні, Цей тиждень, Минулий тиждень, Цей місяць, Минулий місяць, Цей квартал, Минулий квартал — plus a custom from/to range. The default SHALL be no date filter (all dates). Preset boundaries SHALL be computed in the Europe/Kyiv timezone with the week starting Monday. Selecting a preset and entering a custom range SHALL be mutually exclusive. The date filter SHALL combine with search and other filters and SHALL apply across the whole dataset.

Covers: FR-PAY-01, FR-UI-06.

#### Scenario: Default has no date filter

- **WHEN** the admin opens `/payments` or `/acts` without a date param
- **THEN** records of all dates SHALL be eligible (subject to other filters)

#### Scenario: This-month preset

- **WHEN** the admin selects the "Цей місяць" preset
- **THEN** only records whose date falls within the current calendar month (Europe/Kyiv) SHALL be shown

#### Scenario: Custom range

- **WHEN** the admin enters a custom from/to range
- **THEN** only records whose date falls within that inclusive range SHALL be shown, and any active preset SHALL be cleared

#### Scenario: Date filter combines with search

- **WHEN** a date preset and a search term are both active
- **THEN** the results SHALL satisfy both, across the whole dataset

### Requirement: Reset all filters

Each list surface SHALL provide a control that clears the search term and every active filter at once, returning the surface to its default view. The control SHALL be available whenever at least one non-default filter or search term is active.

Covers: FR-CLI-09, FR-PAY-01, FR-UI-06.

#### Scenario: Reset clears everything

- **WHEN** the admin has a search term and one or more filters active and activates the reset control
- **THEN** the search box and all filters SHALL be cleared and the surface SHALL show its default unfiltered list

### Requirement: Active-filter visibility

Each list surface SHALL visually indicate which filters and search are currently applied (for example, removable chips or highlighted controls), so the operator can see what is constraining the list. Each active filter SHALL be individually removable without clearing the others. Filters at their default value SHALL NOT be shown as active.

Covers: FR-CLI-09, FR-PAY-01, FR-UI-06.

#### Scenario: Active filters are shown

- **WHEN** the admin applies a status filter and a date preset
- **THEN** the surface SHALL show both as active filters

#### Scenario: Remove a single active filter

- **WHEN** two filters are active and the admin removes one
- **THEN** only that filter SHALL be cleared and the other SHALL remain applied

### Requirement: Filter state persistence

The URL SHALL be the source of truth for search and filter state, so browser back/forward and returning from a detail page restore the prior filtered view. In addition, the top-navigation links to Clients, Payments, and Acts SHALL remember the last query used for each section, so navigating back to a section via the menu restores its last applied search and filters rather than a bare list. Filter state SHALL NOT leak between sections — a filter applied on one surface SHALL NOT affect another.

Covers: FR-CLI-09, FR-PAY-01, FR-UI-06.

#### Scenario: Returning via the menu keeps filters

- **WHEN** the admin applies filters on `/payments`, navigates to another section via the top menu, then clicks "Платежі" again
- **THEN** the previously applied Payments filters SHALL be restored

#### Scenario: Back navigation restores filters

- **WHEN** the admin opens a record detail from a filtered list and navigates back
- **THEN** the filtered list SHALL be restored

#### Scenario: No cross-section bleed

- **WHEN** a date filter is active on `/payments`
- **THEN** `/acts` SHALL NOT inherit that date filter

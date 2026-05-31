## MODIFIED Requirements

### Requirement: Client list with search and filters

The `/clients` page SHALL display a table of clients with the following capabilities:

- **Search** by `name` (case-insensitive substring), `legal_id` (prefix match), and `moeosbb_user_id` (substring of the id cast to text, when the query is all digits). Search applies across the whole dataset under the active filters (see the `data-tables` debounced-search behavior).
- **Filters** (all combinable):
  - Active (default) / Archive — based on `auto_act_disabled`.
  - Локальні / З "Моє ОСББ" — based on `moeosbb_user_id IS NULL` vs `IS NOT NULL`.
  - `edo_provider` — Дубідок / Вчасно.
- **Columns:** name, legal_id, apartments_count, edo_provider (badge), moeosbb_user_id (display or "—"), created_at.
- **Default sort:** by `moeosbb_user_id` ascending, with clients that have no MoeOSBB id sorted last (see the `data-tables` column-sorting behavior); the admin may re-sort by other columns.
- **Pagination:** server-side, 25 / 50 / 100 rows per page (default 25), per the `data-tables` pagination behavior.
- **Row click** SHALL navigate to `/clients/[id]` (full-row, per `data-tables`).

Covers: FR-CLI-09.

#### Scenario: Default list shows only active clients

- **WHEN** the admin navigates to `/clients` without filter params
- **THEN** only clients with `auto_act_disabled = false` SHALL be displayed

#### Scenario: Search by legal_id

- **WHEN** the admin types "12345678" into the search box
- **THEN** clients whose `legal_id` starts with "12345678" SHALL be displayed (a clients whose `moeosbb_user_id` contains "12345678" SHALL also match)

#### Scenario: Search by partial MoeOSBB id

- **WHEN** the admin types part of a client's MoeOSBB id into the search box
- **THEN** clients whose `moeosbb_user_id` contains that digit fragment SHALL be displayed (substring match, like the name search)

#### Scenario: Filter by edo_provider

- **WHEN** the admin selects the "Вчасно" filter
- **THEN** only clients with `edo_provider = 'vchasno_external'` SHALL be displayed

#### Scenario: Combined search and filter

- **WHEN** the admin searches "ТОВ" and selects "Архів" filter
- **THEN** only clients with `auto_act_disabled = true` whose name contains "ТОВ" (case-insensitive) SHALL be displayed

## ADDED Requirements

### Requirement: Client short display name

The system SHALL support an optional operator-curated short name on each client, stored
in `clients.short_name` (nullable text). The short name is the human-friendly name the
operator uses (e.g. `Молодіжний Новомосковськ`) without the legal-form boilerplate.

A pure helper `displayClientName(client)` SHALL return `client.short_name` when it is a
non-empty (trimmed) string, otherwise `client.name`. The system SHALL NEVER alter the
casing of the short name — it is stored and displayed exactly as the operator entered it.

MoeOSBB sync SHALL NOT modify `short_name`: the field is absent from the sync field
mapper, so a sync update never sets it (protected by omission), preserving the operator's
value.

#### Scenario: Display falls back to full name

- **WHEN** `displayClientName` is called for a client whose `short_name` is NULL or empty
- **THEN** it SHALL return the client's full `name`

#### Scenario: Display uses the short name

- **WHEN** `displayClientName` is called for a client with `short_name = "Молодіжний Новомосковськ"`
- **THEN** it SHALL return `"Молодіжний Новомосковськ"` exactly, preserving casing

#### Scenario: Sync preserves the operator short name

- **WHEN** a MoeOSBB sync runs over a linked client whose `short_name` was set by the operator
- **THEN** the client's `short_name` SHALL remain unchanged after the sync

## MODIFIED Requirements

### Requirement: Admin can create a client

The system SHALL allow the admin to create a new client via the `/clients/new` form. Required fields: `name`, `legal_id`, `email`. Optional fields: `short_name`, `address`, `bank_name`, `bank_account`, `apartments_count`, `access_price_override`, `auto_act_disabled`, `edo_provider`, `moeosbb_user_id`. The `short_name` field SHALL be trimmed and stored as NULL when empty. The `edo_provider` field SHALL default to `dubidoc`. The `auto_act_disabled` field SHALL default to `false`. On success the system SHALL redirect to the client card at `/clients/[id]`.

Covers: FR-CLI-01, FR-CLI-03, FR-CLI-04, FR-CLI-05, FR-CLI-06, BC-USER-03.

#### Scenario: Successful creation with required fields only

- **WHEN** the admin submits the `/clients/new` form with `name = "ТОВ Рога і Копита"`, `legal_id = "12345678"`, `email = "info@example.com"` and leaves all optional fields empty
- **THEN** a `clients` row SHALL be created with `edo_provider = 'dubidoc'`, `auto_act_disabled = false`, `short_name = NULL`, all other optional fields NULL, and the browser SHALL redirect to `/clients/<new-id>`

#### Scenario: Creation with a short name

- **WHEN** the admin fills `short_name = "Молодіжний Новомосковськ"` alongside the required fields
- **THEN** the row SHALL store `short_name = "Молодіжний Новомосковськ"`

#### Scenario: Blank short name normalizes to NULL

- **WHEN** the admin submits `short_name = "   "` (whitespace only)
- **THEN** the row SHALL store `short_name = NULL`

#### Scenario: Creation with all fields populated

- **WHEN** the admin fills all fields including `apartments_count = 50`, `access_price_override = 300.00`, `edo_provider = 'vchasno_external'`, `moeosbb_user_id = 42`
- **THEN** a row SHALL be created with every provided value stored exactly, and `auto_act_disabled = false` (default)

#### Scenario: Prefill from query params

- **WHEN** the admin navigates to `/clients/new?name=ТОВ+Тест&legal_id=12345678&bank_account=UA123456789012345678901234567`
- **THEN** the form fields `name`, `legal_id`, `bank_account` SHALL be prefilled with the query param values (FR-CLI-02)

### Requirement: Admin can edit a client

The system SHALL allow the admin to edit any client field via the client card at `/clients/[id]`. Changes SHALL be persisted immediately upon form submission. The `updated_at` timestamp SHALL be set to the current time. Fields marked as "manual only" (`short_name`, `apartments_count`, `access_price_override`, `auto_act_disabled`, `edo_provider`) SHALL be editable at all times (sync never overwrites them — BC-USER-03). The `short_name` field SHALL be trimmed and stored as NULL when cleared.

Covers: FR-CLI-03, FR-CLI-04, FR-CLI-05, FR-CLI-06, BC-USER-03.

#### Scenario: Edit short name

- **WHEN** the admin sets `short_name = "ЛАД"` on a client and submits
- **THEN** `clients.short_name` SHALL be updated to `"ЛАД"`, `updated_at` SHALL be refreshed, and lists SHALL display the short name

#### Scenario: Clear short name

- **WHEN** the admin clears the `short_name` field and submits
- **THEN** `clients.short_name` SHALL be set to NULL, and lists SHALL fall back to the full name

#### Scenario: Edit apartments_count

- **WHEN** the admin changes `apartments_count` from 50 to 70 on client "ТОВ Рога і Копита"
- **THEN** `clients.apartments_count` SHALL be updated to 70, `updated_at` SHALL be refreshed, and the card SHALL display the new value

#### Scenario: Change edo_provider

- **WHEN** the admin changes `edo_provider` from `dubidoc` to `vchasno_external`
- **THEN** `clients.edo_provider` SHALL be updated to `'vchasno_external'` and a warning SHALL be displayed: "Зміна каналу ЕДО не переоформлює вже згенеровані акти. Нові акти оформлюватимуться за новим каналом."

### Requirement: Client list with search and filters

The `/clients` page SHALL display a table of clients with the following capabilities:

- **Search** by `name` (case-insensitive substring), `short_name` (case-insensitive substring), `legal_id` (prefix match), and `moeosbb_user_id` (substring of the id cast to text, when the query is all digits). Search applies across the whole dataset under the active filters (see the `data-tables` debounced-search behavior).
- **Filters** (all combinable):
  - Active (default) / Archive — based on `auto_act_disabled`.
  - Локальні / З "Моє ОСББ" — based on `moeosbb_user_id IS NULL` vs `IS NOT NULL`.
  - `edo_provider` — Дубідок / Вчасно.
- **Columns:** name (showing `displayClientName` — the short name when set, otherwise the full name, with the full name as a hover tooltip), legal_id, apartments_count, edo_provider (badge), moeosbb_user_id (display or "—"), created_at.
- **Default sort:** by `moeosbb_user_id` ascending, with clients that have no MoeOSBB id sorted last (see the `data-tables` column-sorting behavior); the admin may re-sort by other columns.
- **Pagination:** server-side, 25 / 50 / 100 rows per page (default 25), per the `data-tables` pagination behavior.
- **Row click** SHALL navigate to `/clients/[id]` (full-row, per `data-tables`).

Covers: FR-CLI-09.

#### Scenario: Default list shows only active clients

- **WHEN** the admin navigates to `/clients` without filter params
- **THEN** only clients with `auto_act_disabled = false` SHALL be displayed

#### Scenario: Name column shows the short name

- **WHEN** the admin views a client whose `short_name = "Молодіжний Новомосковськ"`
- **THEN** the "Назва" column SHALL show `"Молодіжний Новомосковськ"` with the full legal name available as a hover tooltip

#### Scenario: Name column falls back to full name

- **WHEN** the admin views a client whose `short_name` is NULL
- **THEN** the "Назва" column SHALL show the full `name`

#### Scenario: Search by short name

- **WHEN** the admin types a fragment of a client's short name
- **THEN** clients whose `short_name` contains that fragment (case-insensitive) SHALL be displayed

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

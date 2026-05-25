## ADDED Requirements

### Requirement: Admin can create a client

The system SHALL allow the admin to create a new client via the `/clients/new` form. Required fields: `name`, `legal_id`, `email`. Optional fields: `address`, `bank_name`, `bank_account`, `apartments_count`, `access_price_override`, `auto_act_disabled`, `edo_provider`, `moeosbb_user_id`. The `edo_provider` field SHALL default to `dubidoc`. The `auto_act_disabled` field SHALL default to `false`. On success the system SHALL redirect to the client card at `/clients/[id]`.

Covers: FR-CLI-01, FR-CLI-03, FR-CLI-04, FR-CLI-05, FR-CLI-06, BC-USER-03.

#### Scenario: Successful creation with required fields only

- **WHEN** the admin submits the `/clients/new` form with `name = "ТОВ Рога і Копита"`, `legal_id = "12345678"`, `email = "info@example.com"` and leaves all optional fields empty
- **THEN** a `clients` row SHALL be created with `edo_provider = 'dubidoc'`, `auto_act_disabled = false`, all optional fields NULL, and the browser SHALL redirect to `/clients/<new-id>`

#### Scenario: Creation with all fields populated

- **WHEN** the admin fills all fields including `apartments_count = 50`, `access_price_override = 300.00`, `edo_provider = 'vchasno_external'`, `moeosbb_user_id = 42`
- **THEN** a row SHALL be created with every provided value stored exactly, and `auto_act_disabled = false` (default)

#### Scenario: Prefill from query params

- **WHEN** the admin navigates to `/clients/new?name=ТОВ+Тест&legal_id=12345678&bank_account=UA123456789012345678901234567`
- **THEN** the form fields `name`, `legal_id`, `bank_account` SHALL be prefilled with the query param values (FR-CLI-02)

### Requirement: Client legal_id validation

The `legal_id` field MUST contain exactly 8 digits (ЄДРПОУ) or exactly 10 digits (РНОКПП). Any other value SHALL be rejected with a Ukrainian field-level error message. Validation SHALL run both client-side (form) and server-side (Zod schema in server action).

Covers: FR-CLI-01.

#### Scenario: Valid 8-digit ЄДРПОУ

- **WHEN** the admin submits `legal_id = "12345678"`
- **THEN** the value SHALL be accepted

#### Scenario: Valid 10-digit РНОКПП

- **WHEN** the admin submits `legal_id = "1234567890"`
- **THEN** the value SHALL be accepted

#### Scenario: Invalid legal_id (wrong length)

- **WHEN** the admin submits `legal_id = "12345"` (5 digits)
- **THEN** the form SHALL display a field error: "ЄДРПОУ (8 цифр) або РНОКПП (10 цифр)"

#### Scenario: Invalid legal_id (non-digits)

- **WHEN** the admin submits `legal_id = "1234ABCD"`
- **THEN** the form SHALL display a field error: "ЄДРПОУ (8 цифр) або РНОКПП (10 цифр)"

### Requirement: Client email validation

The `email` field MUST be a valid email address per standard RFC format. An invalid or empty email SHALL be rejected with a Ukrainian field-level error message.

Covers: FR-CLI-01.

#### Scenario: Valid email

- **WHEN** the admin submits `email = "office@osbb.com"`
- **THEN** the value SHALL be accepted

#### Scenario: Invalid email

- **WHEN** the admin submits `email = "not-an-email"`
- **THEN** the form SHALL display a field error: "Невірний формат email"

### Requirement: Admin can edit a client

The system SHALL allow the admin to edit any client field via the client card at `/clients/[id]`. Changes SHALL be persisted immediately upon form submission. The `updated_at` timestamp SHALL be set to the current time. Fields marked as "manual only" (`apartments_count`, `access_price_override`, `auto_act_disabled`, `edo_provider`) SHALL be editable at all times (sync never overwrites them — BC-USER-03).

Covers: FR-CLI-03, FR-CLI-04, FR-CLI-05, FR-CLI-06, BC-USER-03.

#### Scenario: Edit apartments_count

- **WHEN** the admin changes `apartments_count` from 50 to 70 on client "ТОВ Рога і Копита"
- **THEN** `clients.apartments_count` SHALL be updated to 70, `updated_at` SHALL be refreshed, and the card SHALL display the new value

#### Scenario: Change edo_provider

- **WHEN** the admin changes `edo_provider` from `dubidoc` to `vchasno_external`
- **THEN** `clients.edo_provider` SHALL be updated to `'vchasno_external'` and a warning SHALL be displayed: "Зміна каналу ЕДО не переоформлює вже згенеровані акти. Нові акти оформлюватимуться за новим каналом."

### Requirement: Admin can archive a client

The system SHALL provide an "Архівувати" button on the client card that sets `auto_act_disabled = true`. Archived clients SHALL remain in the database (FK `RESTRICT` prevents deletion — BC-DATA-03). An archived client SHALL appear in the list only when the "Архів" filter is selected. The system SHALL also provide an "Активувати" button on archived clients to set `auto_act_disabled = false`.

Covers: FR-CLI-08, BC-DATA-03.

#### Scenario: Archive an active client

- **WHEN** the admin clicks "Архівувати" on client "ТОВ Тест" (currently `auto_act_disabled = false`)
- **THEN** `clients.auto_act_disabled` SHALL be set to `true`, and the client SHALL no longer appear in the default "Активні" list view

#### Scenario: Reactivate an archived client

- **WHEN** the admin views the "Архів" filter, opens client "ТОВ Тест" card, and clicks "Активувати"
- **THEN** `clients.auto_act_disabled` SHALL be set to `false`, and the client SHALL reappear in the "Активні" list view

### Requirement: Admin can link a client to MoeOSBB

The system SHALL allow the admin to set the `moeosbb_user_id` field on a client card when it is currently NULL. The field MUST be a positive integer and MUST be unique across all clients (DB UNIQUE constraint). Setting `moeosbb_user_id` enables future sync from "Моє ОСББ" (S11). Once linked, the admin SHALL be able to unlink (set to NULL) only via edit — not via a separate "unlink" action.

Covers: FR-CLI-07.

#### Scenario: Link a local client to MoeOSBB

- **WHEN** the admin enters `moeosbb_user_id = 42` on a client whose `moeosbb_user_id` is currently NULL
- **THEN** `clients.moeosbb_user_id` SHALL be set to 42

#### Scenario: Duplicate moeosbb_user_id rejected

- **WHEN** the admin enters `moeosbb_user_id = 42` on client B, but client A already has `moeosbb_user_id = 42`
- **THEN** the form SHALL display a field error: "Цей ID вже прив'язано до іншого клієнта"

### Requirement: Client list with search and filters

The `/clients` page SHALL display a table of clients with the following capabilities:

- **Search** by `name` (case-insensitive substring) and `legal_id` (prefix match).
- **Filters** (all combinable):
  - Active (default) / Archive — based on `auto_act_disabled`.
  - Локальні / З "Моє ОСББ" — based on `moeosbb_user_id IS NULL` vs `IS NOT NULL`.
  - `edo_provider` — Дубідок / Вчасно.
- **Columns:** name, legal_id, apartments_count, edo_provider (badge), moeosbb_user_id (display or "—"), created_at.
- **Default sort:** by `name` ascending.
- **Row click** SHALL navigate to `/clients/[id]`.

No pagination in MVP (≤ 300 clients — design Q-S2-1 resolved).

Covers: FR-CLI-09.

#### Scenario: Default list shows only active clients

- **WHEN** the admin navigates to `/clients` without filter params
- **THEN** only clients with `auto_act_disabled = false` SHALL be displayed

#### Scenario: Search by legal_id

- **WHEN** the admin types "12345678" into the search box
- **THEN** only clients whose `legal_id` starts with "12345678" SHALL be displayed

#### Scenario: Filter by edo_provider

- **WHEN** the admin selects the "Вчасно" filter
- **THEN** only clients with `edo_provider = 'vchasno_external'` SHALL be displayed

#### Scenario: Combined search and filter

- **WHEN** the admin searches "ТОВ" and selects "Архів" filter
- **THEN** only clients with `auto_act_disabled = true` whose name contains "ТОВ" (case-insensitive) SHALL be displayed

### Requirement: Client card with tabs

The client card at `/clients/[id]` SHALL display a tabbed interface with:

- **"Загальна інформація"** tab (default active): editable form with all client fields, grouped by origin (sync vs manual-only).
- **"Договір"** tab: stub placeholder with text "Додайте договір у Slice 3".
- **"Платежі"** tab: stub placeholder with text "Платежі з'являться у Slice 6".
- **"Акти"** tab: stub placeholder with text "Акти з'являться у Slice 8".

A warning banner SHALL be displayed on all tabs if the client has no contract: "Без договору акти не генеруються" (FR-CLI-11). In S2, this warning SHALL always be displayed because contracts do not exist yet.

Covers: FR-CLI-10, FR-CLI-11.

#### Scenario: View client card info tab

- **WHEN** the admin navigates to `/clients/[id]`
- **THEN** the "Загальна інформація" tab SHALL be active by default, showing all client fields in an editable form

#### Scenario: Switch to stub tab

- **WHEN** the admin clicks the "Договір" tab on a client card
- **THEN** the tab SHALL display a placeholder message indicating this capability arrives in Slice 3

#### Scenario: Contract warning always shown in S2

- **WHEN** the admin views any client card in S2 (no contracts table exists yet)
- **THEN** a warning banner "Без договору акти не генеруються" SHALL be visible on every tab

### Requirement: Client cannot be deleted

The system MUST NOT provide a "Delete" action for clients. Clients are soft-archived via `auto_act_disabled = true`. Once contracts, payments, or acts reference a client, the database `RESTRICT` constraint prevents row deletion at the DB level. The UI SHALL NOT expose any delete endpoint or button.

Covers: BC-DATA-03.

#### Scenario: No delete button on client card

- **WHEN** the admin views a client card
- **THEN** no "Видалити" button or action SHALL be present in the UI

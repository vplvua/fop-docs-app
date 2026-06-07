## ADDED Requirements

### Requirement: Client edit form preserves input on validation error

The client-card edit forms (Загальна інформація, Договір) SHALL be controlled forms whose
field values are preserved across a failed save. A validation error (client-side or
returned by the server action) SHALL NOT clear, reset, or revert any field the operator has
entered. The form SHALL validate non-empty values for format both client-side (before
submit) and server-side (authoritative), and SHALL display each field's error inline beneath
that field with a visible invalid state.

On any validation failure the form SHALL display a summary alert at the top of the form
("Виправте N полів") and SHALL move focus to the first invalid field.

#### Scenario: Typed value survives a validation error

- **WHEN** the operator edits a client whose `email` is empty, types `short_name = "ЛАД"`, and submits
- **THEN** the `short_name` field SHALL retain `"ЛАД"` after the failed submit, the `email` field SHALL show an inline format error only if email is non-empty-and-invalid, and no field SHALL be reset to its stored value

#### Scenario: Malformed value is rejected inline without wiping other fields

- **WHEN** the operator types a malformed `email` and a valid `address`, then submits
- **THEN** the `email` field SHALL show an inline error, the `address` field SHALL retain the typed value, and a summary alert SHALL appear with focus on the `email` field

### Requirement: Client edit saves only changed fields

When editing an existing client, the form SHALL submit only the fields the operator changed
(dirty fields). A field the operator did not touch SHALL be absent from the request and
SHALL be left untouched by the server. An empty required field that the operator did not
change SHALL NOT block the save; client completeness is surfaced by the act-readiness
indicator, not by blocking the edit. Format validation SHALL still apply to any changed,
non-empty value.

#### Scenario: Add a name to an imported client with no email

- **WHEN** the operator opens an imported client whose `email` is empty, types `name = "ОСББ Сонячне"`, and submits
- **THEN** `clients.name` SHALL be updated to `"ОСББ Сонячне"`, `updated_at` SHALL be refreshed, the save SHALL succeed without an email error, and the act-readiness indicator SHALL continue to flag the missing email

#### Scenario: Untouched fields are not resubmitted

- **WHEN** the operator changes only `apartments_count` on a client and submits
- **THEN** the request SHALL contain only `apartments_count` (and the client id), and all other stored fields SHALL be unchanged

### Requirement: Client edit form save feedback

On a successful save the client-card edit forms SHALL show a transient success toast
("Збережено"). On a failed save the form SHALL show an error toast ("Не вдалося зберегти")
in addition to the inline field errors and the top-of-form summary. While the form has
unsaved changes it SHALL display a sticky save-bar with the text "Є незбережені зміни" and
two actions: "Скасувати" (revert to the loaded values) and "Зберегти" (submit). The
save-bar SHALL disappear once the form is saved or reverted.

#### Scenario: Success toast on save

- **WHEN** the operator changes a field and the save succeeds
- **THEN** a "Збережено" toast SHALL appear and the sticky save-bar SHALL disappear

#### Scenario: Save-bar reflects unsaved changes

- **WHEN** the operator edits any field
- **THEN** the sticky save-bar SHALL appear with "Скасувати" and "Зберегти"; clicking "Скасувати" SHALL revert all fields to their loaded values and hide the save-bar

### Requirement: Client edit form unsaved-changes guard

While a client-card edit form has unsaved changes, the system SHALL warn the operator before
the changes would be lost. The guard SHALL cover: (a) switching to another tab within the
client card, (b) navigating to another page via an in-app link, and (c) refreshing, closing,
or leaving the browser tab. For (a) and (b) the system SHALL show a dialog "Внесено зміни."
with actions Зберегти / Відхилити / Скасувати; "Зберегти" SHALL save then navigate,
"Відхилити" SHALL navigate discarding changes, and "Скасувати" SHALL stay on the form. For
(c) the system SHALL trigger the browser's native unload confirmation.

#### Scenario: Switching tabs with unsaved changes prompts

- **WHEN** the operator edits a field on the "Загальна інформація" tab and clicks the "Договір" tab
- **THEN** a dialog "Внесено зміни." SHALL appear with Зберегти / Відхилити / Скасувати, and the tab SHALL NOT switch until the operator chooses

#### Scenario: Discard keeps navigation

- **WHEN** the unsaved-changes dialog is open and the operator chooses "Відхилити"
- **THEN** the form changes SHALL be discarded and the requested tab or page SHALL load

#### Scenario: Cancel stays on the form

- **WHEN** the unsaved-changes dialog is open and the operator chooses "Скасувати"
- **THEN** the operator SHALL remain on the current form with all typed values intact

#### Scenario: Browser unload is guarded

- **WHEN** the operator has unsaved changes and refreshes or closes the browser tab
- **THEN** the browser's native "leave site?" confirmation SHALL be triggered

## MODIFIED Requirements

### Requirement: Admin can create a client

The system SHALL allow the admin to create a new client via the `/clients/new` form.
**Tier-1 required fields** (creation is blocked if missing): `name`, `legal_id`, `email`.
**Tier-2 act-required fields** `address`, `bank_name`, `bank_account` SHALL be marked
required in the form (asterisk) and format-validated when filled, but SHALL NOT block
creation when left empty — the act-readiness indicator surfaces the gap instead. Remaining
optional fields: `short_name`, `apartments_count`, `access_price_override`,
`auto_act_disabled`, `edo_provider`, `moeosbb_user_id`. The `short_name` field SHALL be
trimmed and stored as NULL when empty. The `edo_provider` field SHALL default to `dubidoc`.
The `auto_act_disabled` field SHALL default to `false`. On success the system SHALL redirect
to the client card at `/clients/[id]`.

Covers: FR-CLI-01, FR-CLI-03, FR-CLI-04, FR-CLI-05, FR-CLI-06, BC-USER-03.

#### Scenario: Successful creation with Tier-1 fields only

- **WHEN** the admin submits the `/clients/new` form with `name = "ТОВ Рога і Копита"`, `legal_id = "12345678"`, `email = "info@example.com"` and leaves all other fields empty
- **THEN** a `clients` row SHALL be created with `edo_provider = 'dubidoc'`, `auto_act_disabled = false`, `short_name = NULL`, all other optional and Tier-2 fields NULL, the browser SHALL redirect to `/clients/<new-id>`, and the act-readiness indicator SHALL be red listing the missing `address`, `bank_name`, `bank_account`

#### Scenario: Tier-2 fields are asterisked but do not block creation

- **WHEN** the admin leaves `address`, `bank_name`, and `bank_account` empty and submits with valid Tier-1 fields
- **THEN** each Tier-2 field SHALL display a required asterisk, the creation SHALL still succeed, and no Tier-2 emptiness SHALL raise a blocking error

#### Scenario: Malformed Tier-2 value is rejected when filled

- **WHEN** the admin fills a Tier-2 field with a malformed value (per its format rule) and submits
- **THEN** that field SHALL show an inline format error and creation SHALL be blocked until corrected

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

The system SHALL allow the admin to edit any client field via the client card at
`/clients/[id]`. The edit form SHALL be a controlled form that preserves operator input
across validation errors and submits only changed (dirty) fields. Changes SHALL be persisted
immediately upon successful form submission. The `updated_at` timestamp SHALL be set to the
current time. Fields marked as "manual only" (`short_name`, `apartments_count`,
`access_price_override`, `auto_act_disabled`, `edo_provider`) SHALL be editable at all times
(sync never overwrites them — BC-USER-03). The `short_name` field SHALL be trimmed and stored
as NULL when cleared. An empty required field on update SHALL NOT block saving an unrelated
changed field; the act-readiness indicator surfaces client completeness instead.

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

#### Scenario: Partial edit of an incomplete client

- **WHEN** the admin edits an imported client whose `email` is empty, changes only `name`, and submits
- **THEN** the save SHALL succeed, only `name` SHALL be written, and the empty `email` SHALL NOT raise a blocking error

### Requirement: Client card with tabs

The client card at `/clients/[id]` SHALL display a tabbed interface with:

- **"Загальна інформація"** tab (default active): editable form with all client fields, grouped by origin (sync vs manual-only).
- **"Договір"** tab: embedded contract form — create form if no contract exists, edit form with current data if a contract exists.
- **"Платежі"** tab: a table of the client's payments (date, amount, purpose, status), with a **date-range filter** on `payment_date`. No search box and no pagination.
- **"Акти"** tab: a table of the client's acts (number, date, amount, status), with a **date-range filter** on `act_date`. No search box and no pagination.

The date-range filter on the Платежі and Акти tabs SHALL offer the same presets as the main lists (today / this & last week / this & last month / this & last quarter) plus a custom from/to range, default no filter, computed in Europe/Kyiv with the week starting Monday (per the `data-tables` date-range behavior). Each tab's filter SHALL be independent and scoped to the client card.

Switching tabs SHALL respect the unsaved-changes guard: if the currently active editable tab
(Загальна інформація or Договір) has unsaved changes, the system SHALL prompt before
switching and SHALL NOT discard the changes without operator confirmation.

A warning banner SHALL be displayed on all tabs if the client has no contract: "Без договору акти не генеруються" (FR-CLI-11). The warning SHALL NOT be displayed if the client has a contract.

Covers: FR-CLI-10, FR-CLI-11.

#### Scenario: View client card info tab

- **WHEN** the admin navigates to `/clients/[id]`
- **THEN** the "Загальна інформація" tab SHALL be active by default, showing all client fields in an editable form

#### Scenario: Contract tab shows create form when no contract

- **WHEN** the admin clicks the "Договір" tab on a client that has no contract
- **THEN** the tab SHALL display an empty contract creation form with fields: number, signed_date, is_standard, file_url, notes

#### Scenario: Contract tab shows edit form when contract exists

- **WHEN** the admin clicks the "Договір" tab on a client that has a contract
- **THEN** the tab SHALL display the contract data in an editable form, with a "Видалити договір" button

#### Scenario: Payments tab lists the client's payments

- **WHEN** the admin opens the "Платежі" tab
- **THEN** the client's payments SHALL be shown in a table with a date-range filter and no search box or pagination

#### Scenario: Acts tab lists the client's acts

- **WHEN** the admin opens the "Акти" tab
- **THEN** the client's acts SHALL be shown in a table with a date-range filter and no search box or pagination

#### Scenario: Date filter narrows a card tab

- **WHEN** the admin selects a date preset on the "Акти" tab
- **THEN** only the client's acts whose `act_date` falls in that range SHALL be shown, and the "Платежі" tab filter SHALL be unaffected

#### Scenario: Switching tabs with unsaved edits prompts first

- **WHEN** the admin has unsaved changes on the "Загальна інформація" tab and clicks the "Договір" tab
- **THEN** the unsaved-changes dialog SHALL appear and the tab SHALL NOT switch until the admin confirms

#### Scenario: Contract warning shown when no contract

- **WHEN** the admin views any tab of a client card for a client with no contract
- **THEN** a warning banner "Без договору акти не генеруються" SHALL be visible

#### Scenario: Contract warning hidden when contract exists

- **WHEN** the admin views any tab of a client card for a client that has a contract
- **THEN** the warning banner SHALL NOT be displayed

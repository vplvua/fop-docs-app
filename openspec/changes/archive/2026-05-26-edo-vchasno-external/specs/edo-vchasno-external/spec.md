# edo-vchasno-external Specification

## Purpose

Manual EDO workflow for clients with `edo_provider = vchasno_external` — no API integration, admin signs acts externally in Vchasno UI and marks them as signed in the system. State-machine `draft ↔ signed`, PDF regeneration in any status, UI controls for mark/unmark. Covers FR-EDO-20..25, TC-INTEG-04.

## Requirements

## ADDED Requirements

### Requirement: Vchasno acts remain draft without API calls

For acts with `edo_provider = vchasno_external`, the system SHALL NOT call any external EDO API. The act SHALL remain in `draft` status after creation until the admin manually marks it as signed.

Covers: FR-EDO-20, FR-EDO-24, TC-INTEG-04, BC-SCOPE-11.

#### Scenario: Vchasno act stays draft after creation

- **WHEN** an act is created for a client with `edo_provider = vchasno_external`
- **THEN** `Act.status` SHALL be `draft`, `Act.edo_doc_id` SHALL be `NULL`, `Act.edo_status` SHALL be `NULL`, and no external API SHALL be called

#### Scenario: No DubiDoc send for vchasno acts

- **WHEN** a PDF is generated for an act with `edo_provider = vchasno_external`
- **THEN** the system SHALL NOT call DubiDoc `POST /documents`

### Requirement: Admin marks act as signed

The admin SHALL be able to mark a `vchasno_external` act as signed via a "Позначити підписаним" button on the act detail page. The system SHALL transition `Act.status` from `draft` to `signed`.

Covers: FR-EDO-22.

#### Scenario: Mark draft act as signed

- **WHEN** the admin clicks "Позначити підписаним" on an act with `status = draft` and `edo_provider = vchasno_external`
- **THEN** `Act.status` SHALL be updated to `signed` and `Act.updatedAt` SHALL be set to `now()`

#### Scenario: Mark button hidden for non-draft vchasno act

- **WHEN** the act has `status = signed` and `edo_provider = vchasno_external`
- **THEN** the "Позначити підписаним" button SHALL NOT be displayed

#### Scenario: Mark rejected for dubidoc act

- **WHEN** `markActSigned` is called for an act with `edo_provider = dubidoc`
- **THEN** the action SHALL return an error and SHALL NOT update the act status

### Requirement: Admin unmarks signed act

The admin SHALL be able to undo the signed mark via a "Скасувати позначку" button on the act detail page. The system SHALL transition `Act.status` from `signed` back to `draft`.

Covers: FR-EDO-23.

#### Scenario: Unmark signed act to draft

- **WHEN** the admin clicks "Скасувати позначку" on an act with `status = signed` and `edo_provider = vchasno_external`
- **THEN** `Act.status` SHALL be updated to `draft` and `Act.updatedAt` SHALL be set to `now()`

#### Scenario: Unmark button hidden for non-signed vchasno act

- **WHEN** the act has `status = draft` and `edo_provider = vchasno_external`
- **THEN** the "Скасувати позначку" button SHALL NOT be displayed

#### Scenario: Unmark rejected for dubidoc act

- **WHEN** `unmarkActSigned` is called for an act with `edo_provider = dubidoc` and `status = signed`
- **THEN** the action SHALL return an error and SHALL NOT update the act status

### Requirement: PDF regeneration allowed in any status for vchasno

For acts with `edo_provider = vchasno_external`, the admin SHALL be able to regenerate the PDF in any status (`draft` or `signed`). The regeneration SHALL NOT trigger any external API call. The act snapshot SHALL NOT be modified — only the PDF is re-rendered.

Covers: FR-ACT-09.

#### Scenario: Regenerate PDF for signed vchasno act

- **WHEN** the admin clicks "Перегенерувати PDF" on a `vchasno_external` act with `status = signed`
- **THEN** a new PDF SHALL be generated from the existing snapshot and stored, and no external API SHALL be called

#### Scenario: Regenerate PDF for draft vchasno act

- **WHEN** the admin clicks "Перегенерувати PDF" on a `vchasno_external` act with `status = draft`
- **THEN** a new PDF SHALL be generated and stored

### Requirement: Service description editable in any status for vchasno

For acts with `edo_provider = vchasno_external`, the admin SHALL be able to edit the `service_description` field in any status. After saving, the PDF SHALL be automatically regenerated.

Covers: FR-ACT-06.

#### Scenario: Edit description of signed vchasno act

- **WHEN** the admin edits `service_description` on a `vchasno_external` act with `status = signed`
- **THEN** the description SHALL be updated, `Act.updatedAt` SHALL be set to `now()`, and PDF SHALL be regenerated

#### Scenario: Edit blocked for sent dubidoc act

- **WHEN** the admin attempts to edit `service_description` on a `dubidoc` act with `status = sent_to_edo`
- **THEN** the edit SHALL be rejected

### Requirement: Vchasno status banners on act detail

The act detail page SHALL display status banners specific to `vchasno_external` acts: "Очікує підпису у Вчасно" for `status = draft` with PDF, "Підписано у Вчасно" for `status = signed`.

#### Scenario: Draft vchasno act with PDF shows waiting banner

- **WHEN** the act has `edo_provider = vchasno_external`, `status = draft`, and `pdf_file_url IS NOT NULL`
- **THEN** the UI SHALL display a banner "Очікує підпису у Вчасно"

#### Scenario: Signed vchasno act shows signed banner

- **WHEN** the act has `edo_provider = vchasno_external` and `status = signed`
- **THEN** the UI SHALL display a success banner "Підписано у Вчасно"

#### Scenario: Draft vchasno act without PDF shows no banner

- **WHEN** the act has `edo_provider = vchasno_external`, `status = draft`, and `pdf_file_url IS NULL`
- **THEN** no status banner SHALL be displayed

### Requirement: Vchasno badge in acts list

The acts list SHALL display a "Вчасно" badge for acts with `edo_provider = vchasno_external`, using the existing EDO provider column.

Covers: FR-EDO-25 (shared numbering series is already implemented).

#### Scenario: Vchasno badge displayed in list

- **WHEN** the acts list includes an act with `edo_provider = vchasno_external`
- **THEN** the EDO provider column SHALL display "Вчасно"

#### Scenario: Dubidoc badge displayed in list

- **WHEN** the acts list includes an act with `edo_provider = dubidoc`
- **THEN** the EDO provider column SHALL display "Дубідок"

### Requirement: Shared act numbering across EDO providers

Acts for `vchasno_external` clients SHALL use the same numbering series as `dubidoc` acts within the same `(client_id, year, month)`. The existing `nextActNumber` function with `SELECT ... FOR UPDATE` and UNIQUE index SHALL apply equally to both providers.

Covers: FR-EDO-25.

#### Scenario: Mixed provider numbering

- **WHEN** a client has one `dubidoc` act numbered `1` for January 2026 and a `vchasno_external` act is created for the same month
- **THEN** the `vchasno_external` act SHALL be numbered `2` (or `1/2` per the existing numbering format)

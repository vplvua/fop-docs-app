## ADDED Requirements

### Requirement: Each client has zero or one contract

The system SHALL enforce a 0..1 cardinality between `clients` and `contracts` via a UNIQUE constraint on `contracts.client_id`. A client without a contract is valid but cannot have acts generated. A client with a contract cannot have a second contract created.

Covers: FR-CTR-01.

#### Scenario: Client with no contract

- **WHEN** a client exists with no row in `contracts` where `client_id = client.id`
- **THEN** the system SHALL allow creating one contract for that client

#### Scenario: Client already has a contract

- **WHEN** a client already has a contract and the admin attempts to create a second contract for the same client
- **THEN** the system SHALL reject the operation with an error, and the existing contract SHALL remain unchanged

### Requirement: Admin can create a contract

The system SHALL allow the admin to create a contract for a client via the "Договір" tab on the client card at `/clients/[id]?tab=contract`. Required fields: `number`, `signed_date`. Optional fields: `is_standard`, `file_url`, `notes`. The `is_standard` field SHALL default to `true`. On success the form SHALL display a success message and show the saved contract data.

Covers: FR-CTR-01, FR-CTR-02, FR-CTR-03.

#### Scenario: Successful creation with required fields only

- **WHEN** the admin opens the "Договір" tab on a client with no contract, fills `number = "556770"`, `signed_date = "2025-01-15"`, and submits
- **THEN** a `contracts` row SHALL be created with `client_id` matching the current client, `number = '556770'`, `signed_date = '2025-01-15'`, `is_standard = true`, `file_url = NULL`, `notes = NULL`

#### Scenario: Creation with all fields populated

- **WHEN** the admin fills `number = "556770"`, `signed_date = "2025-01-15"`, `is_standard = false`, `file_url = "https://example.com/contract.pdf"`, `notes = "Спеціальні умови"` and submits
- **THEN** a `contracts` row SHALL be created with every provided value stored exactly

#### Scenario: Number pre-filled from moeosbb_user_id

- **WHEN** the admin opens the "Договір" tab on a client with `moeosbb_user_id = 42` and no existing contract
- **THEN** the `number` field SHALL be pre-filled with `"42"` (the string representation of `moeosbb_user_id`)

### Requirement: Contract number validation

The `number` field MUST be a non-empty string. The `signed_date` field MUST be a valid date. Validation SHALL run both client-side (form) and server-side (Zod schema in server action).

Covers: FR-CTR-03.

#### Scenario: Empty number rejected

- **WHEN** the admin submits the contract form with `number = ""` (empty)
- **THEN** the form SHALL display a field error: "Введіть номер договору"

#### Scenario: Missing signed_date rejected

- **WHEN** the admin submits the contract form with `signed_date` left empty
- **THEN** the form SHALL display a field error: "Введіть дату підписання"

### Requirement: Admin can edit a contract

The system SHALL allow the admin to edit any contract field via the "Договір" tab on the client card. Changes SHALL be persisted immediately upon form submission. The `updated_at` timestamp SHALL be set to the current time.

Covers: FR-CTR-02, FR-CTR-04.

#### Scenario: Edit contract number

- **WHEN** the admin changes `number` from "556770" to "556771" on the contract form and submits
- **THEN** `contracts.number` SHALL be updated to "556771" and `updated_at` SHALL be refreshed

#### Scenario: Edit shows warning about existing acts

- **WHEN** the admin edits `number` or `signed_date` on a contract that has associated acts (future S8)
- **THEN** the UI SHALL display a warning: "Зміна номеру/дати не переоформлює вже згенеровані акти" (FR-CTR-04)

### Requirement: Admin can delete a contract

The system SHALL allow the admin to delete a contract via a "Видалити договір" button on the "Договір" tab. Deletion of a contract that has associated acts SHALL be blocked by the database FK RESTRICT constraint (added in S8). In S3, deletion is always allowed because acts do not exist yet. On successful deletion the form SHALL reset to the "create contract" state.

Covers: FR-CTR-02, FR-CTR-05.

#### Scenario: Delete a contract with no acts

- **WHEN** the admin clicks "Видалити договір" on a contract that has no associated acts
- **THEN** the `contracts` row SHALL be deleted and the "Договір" tab SHALL show the empty create-contract form

#### Scenario: Delete blocked when acts exist (S8+)

- **WHEN** the admin attempts to delete a contract that has associated acts (after S8 adds FK RESTRICT)
- **THEN** the system SHALL reject the deletion with an error: "Неможливо видалити договір з прив'язаними актами"

### Requirement: Contract file preview or download

If `file_url` is populated on a contract, the UI SHALL display a download link "Завантажити документ" that opens the URL in a new tab. If the URL ends in `.pdf`, the UI MAY display an iframe preview.

Covers: FR-CTR-06.

#### Scenario: file_url is populated with a PDF

- **WHEN** the admin views the "Договір" tab and the contract has `file_url = "https://example.com/contract.pdf"`
- **THEN** a "Завантажити документ" link SHALL be visible, opening the URL in a new tab

#### Scenario: file_url is empty

- **WHEN** the contract has `file_url = NULL`
- **THEN** no download link or preview SHALL be displayed

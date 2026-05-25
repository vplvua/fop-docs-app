## MODIFIED Requirements

### Requirement: Client card with tabs

The client card at `/clients/[id]` SHALL display a tabbed interface with:

- **"Загальна інформація"** tab (default active): editable form with all client fields, grouped by origin (sync vs manual-only).
- **"Договір"** tab: embedded contract form — create form if no contract exists, edit form with current data if a contract exists.
- **"Платежі"** tab: stub placeholder with text "Платежі з'являться у Slice 6".
- **"Акти"** tab: stub placeholder with text "Акти з'являться у Slice 8".

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

#### Scenario: Contract warning shown when no contract

- **WHEN** the admin views any tab of a client card for a client with no contract
- **THEN** a warning banner "Без договору акти не генеруються" SHALL be visible

#### Scenario: Contract warning hidden when contract exists

- **WHEN** the admin views any tab of a client card for a client that has a contract
- **THEN** the warning banner SHALL NOT be displayed

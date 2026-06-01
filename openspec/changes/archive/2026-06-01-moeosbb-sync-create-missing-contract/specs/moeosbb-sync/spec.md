# moeosbb-sync delta — create missing contract during date sync

## MODIFIED Requirements

### Requirement: Contract date sync from createdt

For each **matched** client (a remote `id` equal to an existing `Client.moeosbb_user_id`) with a usable `createdt`, the sync SHALL ensure the client's contract carries the contract date from `createdt`:

- if the client **already has a contract**, the sync SHALL overwrite that contract's `signed_date` from `createdt`, leaving the contract `number`, `is_standard`, `file_url`, and `notes` unchanged;
- if the client has **no contract**, the sync SHALL create a new standard contract with `signed_date = createdt`, `number = moeosbb_user_id` (the same default the manual contract form uses), and `is_standard = true`.

The remote `createdt` SHALL be normalized to `YYYY-MM-DD` before use: a MySQL `DATE` or `DATETIME` (`YYYY-MM-DD[ HH:MM:SS]`) SHALL contribute its date part, and `DD.MM.YYYY` / `DD/MM/YYYY` SHALL be reordered to `YYYY-MM-DD`. If `createdt` is empty, missing, `0000-00-00`, or otherwise unparseable, the sync SHALL neither update nor create a contract for that client.

Unmatched remote clients (auto-created as new `Client` records) SHALL NOT receive a contract, regardless of `createdt`.

`SyncResult` SHALL report `contractsUpdated` (existing contracts whose `signed_date` changed) and `contractsCreated` (contracts created for matched clients that had none); the dashboard sync message SHALL display both.

#### Scenario: Matched client with a contract gets its date overwritten

- **WHEN** MoeOSBB returns `id = 42, createdt = "2023-05-12 10:30:00"`, a local client has `moeosbb_user_id = 42`, and that client already has a contract `number = "309"` with `signed_date = "2020-01-01"`
- **THEN** the contract's `signed_date` SHALL be updated to `2023-05-12` and its `number` SHALL remain `"309"`

#### Scenario: Matched client without a contract gets a new standard contract

- **WHEN** MoeOSBB returns `id = 309, createdt = "2022-02-15 19:52:58"`, a local client has `moeosbb_user_id = 309`, and that client has no contract
- **THEN** the sync SHALL create a contract for that client with `signed_date = "2022-02-15"`, `number = "309"`, and `is_standard = true`, and SHALL count it in `contractsCreated`

#### Scenario: DD.MM.YYYY date is reordered

- **WHEN** a matched client's `createdt = "12.05.2023"`
- **THEN** the client's contract `signed_date` SHALL be `2023-05-12` (created or updated as applicable)

#### Scenario: Empty or invalid createdt is skipped

- **WHEN** a matched client's `createdt` is `""`, `"0000-00-00"`, or an unparseable string
- **THEN** the sync SHALL neither update nor create a contract for that client

#### Scenario: Unmatched client creates no contract

- **WHEN** a remote client is unmatched and auto-created as a new `Client`
- **THEN** the sync SHALL NOT create a contract for it, even if `createdt` is present

#### Scenario: Counts reported and displayed

- **WHEN** the sync overwrites the date on 370 existing contracts and creates 24 new ones
- **THEN** `SyncResult.contractsUpdated` SHALL be `370`, `SyncResult.contractsCreated` SHALL be `24`, and the dashboard message SHALL include «договорів оновлено 370» and «договорів створено 24»

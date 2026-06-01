# moeosbb-sync delta — contract date sync from createdt

## MODIFIED Requirements

### Requirement: Sync fetches client data from PHP endpoint

The system SHALL fetch client data from the URL specified by `MOEOSBB_SYNC_URL` env var, authenticating with `Authorization: Bearer <MOEOSBB_SYNC_TOKEN>`. The response SHALL be JSON with shape `{ ok: boolean, updated_at: string, count: number, clients: Array<{ id, full_name, osbb_zkpo, legal_address, osbb_bank, osbb_rr, contract_email, createdt }> }`, where `createdt` is the client's contract date from `osbb_users.createdt`.

Covers: FR-SYNC-01, TC-INTEG-03.

#### Scenario: Successful fetch

- **WHEN** the sync runs and the endpoint returns `{ ok: true, clients: [...] }`
- **THEN** the system SHALL process the clients array for selective merge

#### Scenario: Endpoint returns error

- **WHEN** the endpoint returns HTTP 500 or non-JSON response
- **THEN** the system SHALL record an integration error and SHALL NOT modify any client data

#### Scenario: Endpoint returns 401

- **WHEN** the endpoint returns HTTP 401 (invalid token)
- **THEN** the system SHALL record an integration error with message indicating auth failure

#### Scenario: createdt absent from response

- **WHEN** the endpoint response omits `createdt` for a client (e.g. before the PHP endpoint exposes the column)
- **THEN** the rest of the selective merge SHALL proceed unaffected and the contract date SHALL be left unchanged for that client

## ADDED Requirements

### Requirement: Contract date sync from createdt

For each **matched** client (a remote `id` equal to an existing `Client.moeosbb_user_id`), the sync SHALL update that client's contract `signed_date` from the remote `createdt`, overwriting any existing value. The remote `createdt` SHALL be normalized to `YYYY-MM-DD` before writing: a MySQL `DATE` or `DATETIME` (`YYYY-MM-DD[ HH:MM:SS]`) SHALL contribute its date part, and `DD.MM.YYYY` / `DD/MM/YYYY` SHALL be reordered to `YYYY-MM-DD`. If `createdt` is empty, missing, `0000-00-00`, or otherwise unparseable, the sync SHALL skip the contract update for that client and SHALL NOT modify the stored `signed_date`.

The sync SHALL NOT create a contract: a matched client with no contract row, and any unmatched (newly auto-created) client, SHALL receive no contract — the contract `number` is required and is not provided by MoeOSBB. The contract date SHALL be written only where a contract already exists.

`SyncResult` SHALL include a `contractsUpdated` count of the contract rows whose `signed_date` was updated, and the dashboard sync message SHALL display it.

#### Scenario: Matched client with a contract gets its date overwritten

- **WHEN** MoeOSBB returns `id = 42, createdt = "2023-05-12 10:30:00"`, a local client has `moeosbb_user_id = 42`, and that client already has a contract with `signed_date = "2020-01-01"`
- **THEN** the contract's `signed_date` SHALL be updated to `2023-05-12`, regardless of the previous value

#### Scenario: DD.MM.YYYY date is reordered

- **WHEN** a matched client's `createdt = "12.05.2023"`
- **THEN** the contract's `signed_date` SHALL be set to `2023-05-12`

#### Scenario: Empty or invalid createdt is skipped

- **WHEN** a matched client's `createdt` is `""`, `"0000-00-00"`, or an unparseable string
- **THEN** the sync SHALL NOT modify that client's contract `signed_date`

#### Scenario: Matched client without a contract creates none

- **WHEN** a matched client has a valid `createdt` but no contract row
- **THEN** the sync SHALL NOT create a contract and SHALL leave `contractsUpdated` unincremented for that client

#### Scenario: Unmatched client creates no contract

- **WHEN** a remote client is unmatched and auto-created as a new `Client`
- **THEN** the sync SHALL NOT create a contract for it, even if `createdt` is present

#### Scenario: contractsUpdated reported and displayed

- **WHEN** the sync updates the contract date for 3 matched clients
- **THEN** `SyncResult.contractsUpdated` SHALL be `3` and the dashboard message SHALL include «договорів оновлено 3»

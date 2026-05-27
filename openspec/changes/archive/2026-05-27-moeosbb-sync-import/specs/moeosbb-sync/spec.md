# moeosbb-sync delta — auto-creation of new clients

## MODIFIED Requirements

### Requirement: Match by moeosbb_user_id

The sync SHALL match each remote client `id` to `Client.moeosbb_user_id`. For matched clients, the existing selective merge SHALL apply. For unmatched remote clients (no local client with that `moeosbb_user_id`), the sync SHALL create a new Client record with the mapped fields and default values. Local clients without `moeosbb_user_id` SHALL NOT be affected.

Covers: FR-SYNC-02.

#### Scenario: Matched client updated

- **WHEN** MoeOSBB returns a client with `id = 42` and a local client has `moeosbb_user_id = 42`
- **THEN** the local client SHALL be updated with the merged fields

#### Scenario: Unmatched remote client creates new client

- **WHEN** MoeOSBB returns a client with `id = 999` but no local client has `moeosbb_user_id = 999`
- **THEN** the system SHALL create a new Client with `moeosbb_user_id = 999`, mapped fields from the remote data, and default values for remaining fields

#### Scenario: Local client without moeosbb_user_id skipped

- **WHEN** a local client has `moeosbb_user_id = NULL`
- **THEN** the sync SHALL NOT attempt to match or modify this client

#### Scenario: Duplicate prevention on re-sync

- **WHEN** a remote client with `id = 42` was already created in a previous sync
- **THEN** the next sync SHALL match and update it (not create a duplicate), because `moeosbb_user_id` has a UNIQUE constraint

## ADDED Requirements

### Requirement: Default values for new clients from MoeOSBB

New clients created during sync SHALL have the following default values: `edo_provider = "dubidoc"`, `auto_act_disabled = false`, `apartments_count = NULL`, `access_price_override = NULL`. The `moeosbb_user_id` SHALL be set to the remote client's `id`. The `last_sync_at` SHALL be set to `now()`.

#### Scenario: New client has correct defaults

- **WHEN** a new client is created from MoeOSBB data with `id = 42`, `full_name = "ОСББ Нове"`
- **THEN** the Client record SHALL have `name = "ОСББ Нове"`, `moeosbb_user_id = 42`, `edo_provider = "dubidoc"`, `auto_act_disabled = false`, `apartments_count = NULL`, `last_sync_at = now()`

### Requirement: Sync result includes created count

`SyncResult` SHALL include a `created` field indicating how many new clients were created during the sync. The dashboard UI SHALL display this count alongside fetched/matched/updated.

#### Scenario: UI shows created count

- **WHEN** sync creates 5 new clients, updates 10 existing
- **THEN** the UI message SHALL include "створено 5" alongside the other counts

### Requirement: Single-client sync does not create

When `runMoeosbbSync` is called with `singleMoeosbbId`, auto-creation SHALL NOT apply. If the specified ID is not found among remote clients, the sync SHALL complete with zero matches.

#### Scenario: Single-client sync with no match

- **WHEN** `syncSingleClientAction` is called for a client with `moeosbb_user_id = 555` and no remote client has `id = 555`
- **THEN** the sync SHALL complete with `matched = 0, created = 0` and SHALL NOT create a new client

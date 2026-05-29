# moeosbb-sync Specification

## Purpose

Read-only sync of client data from external "Моє ОСББ" system via PHP endpoint. Selective field merge (6 fields synced, 4 protected), schedule-based cron (daily/first/last/manual, default daily), manual trigger, integration health tracking. Covers FR-SYNC-01..06, TC-INTEG-03.

## Requirements

### Requirement: Sync fetches client data from PHP endpoint

The system SHALL fetch client data from the URL specified by `MOEOSBB_SYNC_URL` env var, authenticating with `Authorization: Bearer <MOEOSBB_SYNC_TOKEN>`. The response SHALL be JSON with shape `{ ok: boolean, updated_at: string, count: number, clients: Array<{ id, full_name, osbb_zkpo, legal_address, osbb_bank, osbb_rr, contract_email }> }`.

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

### Requirement: Selective field merge

The sync SHALL update only the following Client fields from MoeOSBB data: `name` (from `full_name`), `legal_id` (from `osbb_zkpo`), `address` (from `legal_address`), `bank_name` (from `osbb_bank`), `bank_account` (from `osbb_rr`), `email` (from `contract_email`). The sync SHALL NOT modify: `apartments_count`, `access_price_override`, `auto_act_disabled`, `edo_provider`.

Covers: FR-SYNC-01, FR-SYNC-05.

#### Scenario: Name changed in MoeOSBB

- **WHEN** a client with `moeosbb_user_id = 42` has `name = "ОСББ Старе"` locally, and MoeOSBB returns `full_name = "ОСББ Нове"` for `id = 42`
- **THEN** `Client.name` SHALL be updated to `"ОСББ Нове"`

#### Scenario: Protected fields preserved

- **WHEN** a client has `apartments_count = 100` and `edo_provider = "vchasno_external"` locally
- **THEN** after sync, `apartments_count` SHALL remain `100` and `edo_provider` SHALL remain `"vchasno_external"`, regardless of MoeOSBB data

#### Scenario: No changes needed

- **WHEN** all synced fields already match MoeOSBB data
- **THEN** the system SHALL still update `Client.last_sync_at` but MAY skip the UPDATE query for unchanged fields

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

### Requirement: Schedule-based cron execution

A cron job SHALL fire daily (`0 4 * * *`, after the 03:00 replica refresh). The handler SHALL read `Settings.moeosbb_sync_schedule` and execute sync only when the schedule condition is met: `"daily"` — every day; `"first"` — day 1 of the month; `"last"` — last day of the month; `"manual"` — never auto-execute. The default schedule SHALL be `"daily"`.

Covers: FR-SYNC-03.

#### Scenario: Daily schedule on any day

- **WHEN** the cron fires on any calendar day and `moeosbb_sync_schedule = "daily"`
- **THEN** the sync SHALL execute

#### Scenario: First-of-month schedule on day 1

- **WHEN** the cron fires on January 1 and `moeosbb_sync_schedule = "first"`
- **THEN** the sync SHALL execute

#### Scenario: First-of-month schedule on day 15

- **WHEN** the cron fires on January 15 and `moeosbb_sync_schedule = "first"`
- **THEN** the sync SHALL NOT execute (skip silently)

#### Scenario: Last-day schedule on last day

- **WHEN** the cron fires on January 31 and `moeosbb_sync_schedule = "last"`
- **THEN** the sync SHALL execute

#### Scenario: Manual schedule blocks auto-execution

- **WHEN** the cron fires and `moeosbb_sync_schedule = "manual"`
- **THEN** the sync SHALL NOT execute

### Requirement: Manual sync trigger

The admin SHALL be able to trigger sync outside of the cron schedule via a "Синхронізувати Моє ОСББ зараз" button on the dashboard and a "Синхронізувати" button on individual client cards. Manual trigger SHALL always execute regardless of `moeosbb_sync_schedule` setting.

Covers: FR-SYNC-04.

#### Scenario: Manual sync from dashboard

- **WHEN** the admin clicks "Синхронізувати Моє ОСББ зараз" on the dashboard
- **THEN** the system SHALL fetch and merge all matched clients from MoeOSBB

#### Scenario: Manual sync from client card

- **WHEN** the admin clicks "Синхронізувати" on a client card with `moeosbb_user_id = 42`
- **THEN** the system SHALL fetch all clients from MoeOSBB, find `id = 42`, and merge only that client's fields

### Requirement: No delta reporting

The sync SHALL NOT display or log which specific fields changed for each client. It SHALL simply overwrite the synced fields with the latest values.

Covers: FR-SYNC-06.

#### Scenario: Silent overwrite

- **WHEN** sync updates 3 fields for a client
- **THEN** the system SHALL NOT produce a diff or change log visible to the admin

### Requirement: Integration health tracking

Both cron and manual sync operations SHALL update `integration_health` for `service = 'moeosbb'`. On success: `last_success_at = now()`. On failure: `last_error_at = now()`, `last_error_message` with a descriptive error.

#### Scenario: Successful sync updates health

- **WHEN** the sync completes successfully
- **THEN** `integration_health` for `moeosbb` SHALL have `last_success_at` updated

#### Scenario: Failed sync updates health with error

- **WHEN** the sync fails (network error, invalid response, etc.)
- **THEN** `integration_health` for `moeosbb` SHALL have `last_error_at` and `last_error_message` updated

### Requirement: Client last_sync_at updated

After a successful sync, `Client.last_sync_at` SHALL be set to `now()` for every client that was processed (matched and merged).

#### Scenario: last_sync_at updated after sync

- **WHEN** the sync successfully merges data for a client with `moeosbb_user_id = 42`
- **THEN** `Client.last_sync_at` SHALL be set to `now()`

### Requirement: Cron registered in vercel.ts

The MoeOSBB sync cron SHALL be registered in `vercel.ts` at path `/api/cron/moeosbb-sync` with schedule `0 4 * * *` (daily at 04:00 UTC, after the 03:00 hosting replica refresh).

#### Scenario: Cron registered

- **WHEN** `vercel.ts` is loaded
- **THEN** the crons array SHALL include `{ path: "/api/cron/moeosbb-sync", schedule: "0 4 * * *" }`

### Requirement: CRON_SECRET guard on cron handler

The cron handler SHALL verify `Authorization: Bearer <CRON_SECRET>` header, consistent with existing cron handlers (privatbank-poll, dubidoc-poll).

#### Scenario: Valid CRON_SECRET

- **WHEN** the cron request includes a valid `Authorization` header
- **THEN** the handler SHALL proceed with sync execution

#### Scenario: Missing CRON_SECRET

- **WHEN** the cron request has no `Authorization` header
- **THEN** the handler SHALL return 401

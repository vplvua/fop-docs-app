# moeosbb-sync Specification

## Purpose

Read-only sync of client data from external "Моє ОСББ" system via PHP endpoint. Selective field merge (6 fields synced, 4 protected), schedule-based cron (first/last/manual), manual trigger, integration health tracking. Covers FR-SYNC-01..06, TC-INTEG-03.

## Requirements

## ADDED Requirements

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

The sync SHALL apply only to clients with `moeosbb_user_id IS NOT NULL`. Each remote client `id` SHALL be matched to `Client.moeosbb_user_id`. Remote clients without a matching local client SHALL be ignored (no auto-creation).

Covers: FR-SYNC-02.

#### Scenario: Matched client updated

- **WHEN** MoeOSBB returns a client with `id = 42` and a local client has `moeosbb_user_id = 42`
- **THEN** the local client SHALL be updated with the merged fields

#### Scenario: Unmatched remote client ignored

- **WHEN** MoeOSBB returns a client with `id = 999` but no local client has `moeosbb_user_id = 999`
- **THEN** the system SHALL skip this remote client without error

#### Scenario: Local client without moeosbb_user_id skipped

- **WHEN** a local client has `moeosbb_user_id = NULL`
- **THEN** the sync SHALL NOT attempt to match or modify this client

### Requirement: Schedule-based cron execution

A cron job SHALL fire daily (`0 0 * * *`). The handler SHALL read `Settings.moeosbb_sync_schedule` and execute sync only when the schedule condition is met: `"first"` — day 1 of the month; `"last"` — last day of the month; `"manual"` — never auto-execute.

Covers: FR-SYNC-03.

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

The MoeOSBB sync cron SHALL be registered in `vercel.ts` at path `/api/cron/moeosbb-sync` with schedule `0 0 * * *` (daily at midnight UTC).

#### Scenario: Cron registered

- **WHEN** `vercel.ts` is loaded
- **THEN** the crons array SHALL include `{ path: "/api/cron/moeosbb-sync", schedule: "0 0 * * *" }`

### Requirement: CRON_SECRET guard on cron handler

The cron handler SHALL verify `Authorization: Bearer <CRON_SECRET>` header, consistent with existing cron handlers (privatbank-poll, dubidoc-poll).

#### Scenario: Valid CRON_SECRET

- **WHEN** the cron request includes a valid `Authorization` header
- **THEN** the handler SHALL proceed with sync execution

#### Scenario: Missing CRON_SECRET

- **WHEN** the cron request has no `Authorization` header
- **THEN** the handler SHALL return 401

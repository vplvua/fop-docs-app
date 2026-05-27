## Context

S11 brings the last external integration — syncing client data from the "Моє ОСББ" MySQL database. The infrastructure was resolved during explore (TBD-S11-1): instead of direct MySQL access from Vercel, a PHP endpoint on the shared hosting serves a JSON snapshot from a daily replica.

Existing infrastructure already supports this:

- `Client.last_sync_at` field exists in schema (added in S2)
- `integration_health(service='moeosbb')` type registered in `lib/observability/`
- `Settings.moeosbb_sync_schedule` seeded with default `"first"` (added in S5)
- Classification pipeline already handles `moeosbb_user_id` matching (S7)

## Goals / Non-Goals

**Goals:**

- Fetch client data from PHP endpoint and selectively merge into local Client records.
- Support scheduled sync (1st of month / last day / manual-only) via cron.
- Provide manual "Sync now" trigger from dashboard and client card.
- Track sync health via `integration_health`.

**Non-Goals:**

- No write-back to MoeOSBB (read-only sync).
- No real-time sync (daily replica is sufficient).
- No diffing or delta reporting (FR-SYNC-06: just overwrite).
- No sync of `apartments_count`, `access_price_override`, `auto_act_disabled`, `edo_provider` (FR-SYNC-05).
- No creating new clients from MoeOSBB data — only update existing linked clients.

## Decisions

### D1: HTTP fetch instead of MySQL connection (resolves TBD-S11-1)

Vercel functions fetch `https://moeosbb-sync.moeosbb.com/api.php` with Bearer token auth. The PHP endpoint reads from a daily mysqldump replica on shared hosting (Хостинг Україна). MySQL port stays closed to external connections.

**Why over direct MySQL:** Shared hosting (ukraine.com.ua, plan "Якісний") cannot reliably expose MySQL to Vercel's unpredictable egress IPs. PHP endpoint gives HTTPS + Bearer token + localhost-only MySQL — three layers of isolation.

**Env vars:** `MOEOSBB_SYNC_URL` (endpoint URL) and `MOEOSBB_SYNC_TOKEN` (Bearer token) replace the PRD-specified `MOEOSBB_DB_URL`.

### D2: Selective field merge in domain layer

`lib/external-apis/moeosbb/sync.ts` contains a pure `mergeClientFields(localClient, remoteClient)` function that returns only the fields to update. This is unit-testable without DB access.

Synced fields: `name`, `legalId`, `address`, `bankName`, `bankAccount`, `email`.
Protected fields: `apartmentsCount`, `accessPriceOverride`, `autoActDisabled`, `edoProvider`.

**Why pure function:** Makes the critical business rule (which fields are protected) trivially testable.

### D3: Cron runs daily, handler checks schedule

The Vercel cron fires `0 0 * * *` (daily at midnight UTC). The handler reads `Settings.moeosbb_sync_schedule` and decides whether to execute:

- `"first"` — execute only on day 1 of the month
- `"last"` — execute only on the last day of the month
- `"manual"` — never auto-execute

This matches the PrivatBank/DubiDoc cron pattern — cron fires regularly, handler gates execution.

**Why not dynamic cron schedule:** Vercel cron schedules are static in `vercel.ts`. The handler-side check is simpler and already proven in S6/S9.

### D4: Match by `moeosbb_user_id`

The sync matches remote `id` (from JSON) to local `Client.moeosbb_user_id`. Clients without `moeosbb_user_id` are skipped. Remote clients not matched to any local client are ignored (no auto-creation).

### D5: MSW mock for the PHP endpoint

Tests use MSW handler in `tests/mocks/handlers/moeosbb.ts` following the D-039 convention. The mock returns the same JSON shape as the real PHP endpoint: `{ ok, updated_at, count, clients[] }`.

## Risks / Trade-offs

- **[Low] Stale data**: Replica updates at 03:00 Kyiv time. If a client changes data in MoeOSBB after that and sync runs before next replica refresh, we see yesterday's data. Acceptable for monthly sync.
- **[Low] PHP endpoint downtime**: If the hosting is down, sync fails and `integration_health` records the error. Next cron retry will succeed. Manual "Sync now" is available.
- **[Low] Field name mismatch**: PHP endpoint returns MySQL column names (`full_name`, `osbb_zkpo`, etc.), not Client field names. The mapper handles translation — tested via unit tests.

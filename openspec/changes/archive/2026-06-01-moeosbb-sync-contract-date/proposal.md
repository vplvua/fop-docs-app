## Why

The MoeOSBB sync keeps a client's name, ЄДРПОУ, address and bank requisites in step with the external system, but the **contract date** — the «по договору № … від `<date>`» that every act PDF prints from `contracts.signed_date` — is entered and maintained entirely by hand. MoeOSBB already records that date as `osbb_users.createdt`, so the source of truth exists; the sync just never read it. Operators end up retyping a date that the upstream system already holds, and drift between the two is invisible until it shows up on a printed act.

This change makes `osbb_users.createdt` flow into `contracts.signed_date` on every sync, for clients that already have a contract.

## What Changes

- The sync response shape gains a `createdt` field per remote client (`osbb_users.createdt`).
- For every **matched** client that already has a contract row, the sync updates `contracts.signed_date` from `createdt`. Per the operator decision, MoeOSBB is the source of truth: the date is **always overwritten**, even if it was set manually.
- `createdt` is **normalized** to `YYYY-MM-DD` before writing: MySQL `DATE`/`DATETIME` (`YYYY-MM-DD[ HH:MM:SS]`) and `DD.MM.YYYY` / `DD/MM/YYYY` are accepted; empty, `0000-00-00`, missing, or unparseable values are skipped (no write), so a malformed upstream value can never blank out a contract date.
- No contract is **created** during sync — neither for a matched client that lacks a contract, nor for an unmatched (newly auto-created) client — because `contracts.number` is required and MoeOSBB does not supply it. The contract date only lands where a contract already exists.
- `SyncResult` gains a `contractsUpdated` count; the dashboard sync message appends «договорів оновлено N».

## Capabilities

### New Capabilities

_(no new capabilities)_

### Modified Capabilities

- `moeosbb-sync`: the fetch response shape gains `createdt`; a new requirement governs syncing the contract date from `createdt` into `contracts.signed_date` (matched + existing-contract only, always-overwrite, with normalization and skip-on-garbage). `SyncResult` reports `contractsUpdated`.

## Impact

- **`lib/external-apis/moeosbb/types.ts`** — `MoeosbbRemoteClient` gains `createdt: string`.
- **`lib/external-apis/moeosbb/mapper.ts`** — new pure `mapRemoteContractDate(remote)` → `YYYY-MM-DD | null`.
- **`lib/external-apis/moeosbb/sync.ts`** — `planSync`/`applySync` thread the normalized date; `UPDATE contracts SET signed_date WHERE client_id = …` for matched clients with a parseable `createdt`; `SyncResult.contractsUpdated`.
- **`app/(dashboard)/moeosbb-sync-button.tsx`** — surfaces `contractsUpdated`.
- **`tests/unit/moeosbb/`** + **`tests/mocks/handlers/moeosbb.ts`** — `createdt` fixtures + `mapRemoteContractDate` tests.
- **No DB migration** — `contracts.signed_date` already exists (S3).
- **External (out of repo, human-gated):** the PHP endpoint (`api.php`) `SELECT` over `osbb_users` MUST start returning the `createdt` column. Until it does, `remote.createdt` is `undefined`, `mapRemoteContractDate` returns `null`, and the sync no-ops on contract dates — the rest of the sync is unaffected.

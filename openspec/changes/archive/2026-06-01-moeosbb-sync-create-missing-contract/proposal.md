## Why

`moeosbb-sync-contract-date` synced `osbb_users.createdt` into `contracts.signed_date`, but only for clients that **already had a contract** — by design it never created one (the contract `number` was considered unavailable from MoeOSBB). The first production run exposed the gap: of 394 matched clients, 370 had their date updated and **24 were silently skipped because they had no contract row**. The operator expected those to be filled too.

The `number` is in fact available: the manual contract form already pre-fills it from `moeosbb_user_id` (`CreateContractForm` → `defaults.number = String(client.moeosbbUserId)`). So the sync has everything it needs to create the missing contract instead of skipping it.

This revises the `moeosbb-sync-contract-date` decision "no contract is created during sync" for the **matched** case.

## What Changes

- For a **matched** client with **no contract**, the sync now **creates** a standard contract: `signed_date = createdt`, `number = moeosbb_user_id`, `is_standard = true` (mirrors the manual form's defaults).
- For a matched client that **already has a contract**, behavior is unchanged — only `signed_date` is overwritten; `number`, `is_standard`, `file_url`, `notes` are left intact.
- **Unmatched** (newly auto-created) clients still receive **no** contract — unchanged.
- `createdt` normalization and skip-on-empty/`0000-00-00`/unparseable are unchanged: a client with no usable `createdt` is neither updated nor created.
- `SyncResult` splits the contract outcome into `contractsUpdated` (existing rows changed) and `contractsCreated` (new rows); the dashboard message shows both.

## Capabilities

### New Capabilities

_(no new capabilities)_

### Modified Capabilities

- `moeosbb-sync`: the "Contract date sync from createdt" requirement is revised — a matched client without a contract now gets one created (number from `moeosbb_user_id`) rather than skipped; `SyncResult` adds `contractsCreated` alongside `contractsUpdated`.

## Impact

- **`lib/external-apis/moeosbb/sync.ts`** — `ClientUpdate` carries `moeosbbUserId`; new `syncContracts` helper pre-queries existing contracts for matched clients with a date, partitions into update vs insert, and runs both under `Promise.allSettled`; `SyncResult.contractsCreated` + log field.
- **`app/(dashboard)/moeosbb-sync-button.tsx`** — message appends «договорів створено N».
- **`tests/unit/moeosbb/sync-import.test.ts`** — result-shape assertion for the updated/created split.
- **No DB migration** — `contracts` table and its `contracts_client_id_unique` index already exist (S3).
- **No external change** — the PHP endpoint already returns `createdt` (verified in production: `2022-02-15 19:52:58` form).

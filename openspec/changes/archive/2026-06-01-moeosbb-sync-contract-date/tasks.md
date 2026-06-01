## 1. Types & mapping (lib, pure)

- [x] 1.1 Add `createdt: string` to `MoeosbbRemoteClient` (`lib/external-apis/moeosbb/types.ts`), documented as `osbb_users.createdt` (MySQL DATE/DATETIME, may be empty)
- [x] 1.2 Add pure `mapRemoteContractDate(remote)` → `YYYY-MM-DD | null` in `lib/external-apis/moeosbb/mapper.ts`: accept `YYYY-MM-DD[ HH:MM:SS]` and `DD.MM.YYYY` / `DD/MM/YYYY`; return `null` for empty, `0000-00-00`, missing, or unparseable input (reads `remote.createdt ?? ""` so it is safe before the column ships)

## 2. Sync orchestrator (lib)

- [x] 2.1 Thread the normalized contract date through `planSync` (carry `contractDate` per matched-client update); leave inserts (auto-created clients) without a contract
- [x] 2.2 In `applySync`, for matched clients with a non-null `contractDate`, run `UPDATE contracts SET signed_date = …, updated_at = now() WHERE client_id = <localId>` under `Promise.allSettled` (a client without a contract matches zero rows — no insert, no error). Always overwrite (MoeOSBB is source of truth)
- [x] 2.3 Extend `SyncResult` with `contractsUpdated` (count of fulfilled contract updates); log it under `event: "moeosbb.sync_complete"`
- [x] 2.4 Confirm **no DB migration** — `contracts.signed_date` already exists (S3)

## 3. UI

- [x] 3.1 `app/(dashboard)/moeosbb-sync-button.tsx` appends «договорів оновлено N» to the post-sync message from `result.contractsUpdated`

## 4. Tests & mocks

- [x] 4.1 `tests/mocks/handlers/moeosbb.ts` sample clients carry `createdt` (DATETIME + plain DATE forms)
- [x] 4.2 `mapRemoteContractDate` unit tests: DATETIME → date, plain ISO passthrough, `DD.MM.YYYY` / `DD/MM/YYYY` reorder, whitespace trim, null for empty / `0000-00-00` / unparseable
- [x] 4.3 Update existing moeosbb fixtures (`mapper.test.ts`, `sync-import.test.ts`) for the new required field

## 5. Quality gate & verification

- [x] 5.1 `npm run typecheck` clean; `npm run lint` 0 errors; moeosbb unit suite green (31/31)
- [x] 5.2 Manual smoke on prod (2026-06-01): sync ran, dashboard showed «договорів оновлено 370» (of 394 matched), real `createdt` format confirmed `2022-02-15 19:52:58` (matches the normalizer)

## 6. External prerequisite (out of repo, human-gated)

- [x] 6.1 PHP sync endpoint (`api.php`) `SELECT` over `osbb_users` updated to include `createdt`; verified returning it in the JSON (done by the operator on shared hosting)

## 1. Sync orchestrator (lib)

- [x] 1.1 Carry `moeosbbUserId` on `ClientUpdate` (needed as the contract `number` for create)
- [x] 1.2 Add `syncContracts(datedUpdates)`: `SELECT client_id FROM contracts WHERE client_id IN (…)` → partition matched-with-date into update (has contract) vs create (none)
- [x] 1.3 Update path: `UPDATE contracts SET signed_date, updated_at WHERE client_id = …` (number/is_standard/file_url/notes untouched), under `Promise.allSettled`
- [x] 1.4 Create path: `INSERT INTO contracts (client_id, number = String(moeosbb_user_id), signed_date)` (`is_standard` via column default `true`), under `Promise.allSettled`
- [x] 1.5 `SyncResult` gains `contractsCreated` alongside `contractsUpdated`; both logged under `moeosbb.sync_complete`

## 2. UI

- [x] 2.1 `moeosbb-sync-button.tsx` message appends «договорів створено N» from `result.contractsCreated`

## 3. Tests & quality gate

- [x] 3.1 `sync-import.test.ts`: assert the contract outcome splits into `contractsUpdated` + `contractsCreated` (370 + 24 = 394 from the prod run)
- [x] 3.2 `npm run typecheck` clean; `npm run lint` 0 errors; moeosbb unit suite green (32/32)

## 4. Verification

- [x] 4.1 Re-ran «Синхронізувати Моє ОСББ зараз» on prod (2026-06-01): contracts updated/created for the matched clients (incl. the previously-skipped contract-less ones), confirmed by the operator

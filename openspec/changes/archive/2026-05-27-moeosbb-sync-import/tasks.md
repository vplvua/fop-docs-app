## 1. Domain logic

- [x] 1.1 Extend `SyncResult` in `lib/external-apis/moeosbb/sync.ts` — add `created: number` field.
- [x] 1.2 Modify `runMoeosbbSync` — collect unmatched remote clients (when `singleMoeosbbId` is undefined), INSERT new Client rows with mapped fields + defaults (`moeosbbUserId`, `edoProvider = "dubidoc"`, `autoActDisabled = false`, `lastSyncAt = now()`). Use `Promise.allSettled` for inserts. Return `created` count.

## 2. UI

- [x] 2.1 Update `app/(dashboard)/moeosbb-sync-button.tsx` — show `created` in the result message ("створено N" alongside fetched/matched/updated).

## 3. Tests

- [x] 3.1 Add unit tests for auto-creation in `tests/unit/moeosbb/sync-import.test.ts` — unmatched remote creates new client, matched remote updates existing, single-client mode skips creation, duplicate prevention via UNIQUE constraint.

## 4. QA

- [x] 4.1 Run `npm run qa` — all 6 gates must pass.

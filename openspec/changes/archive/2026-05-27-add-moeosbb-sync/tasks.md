## 1. HTTP client

- [x] 1.1 Create `lib/external-apis/moeosbb/client.ts` — `fetchMoeosbbClients()` fetches `MOEOSBB_SYNC_URL` with Bearer token from `MOEOSBB_SYNC_TOKEN`, validates response shape `{ ok, clients[] }`, returns typed array. Retry with backoff on 5xx (1s/5s/30s, 3 attempts).
- [x] 1.2 Create `lib/external-apis/moeosbb/types.ts` — types for remote client (`MoeosbbRemoteClient`) and endpoint response (`MoeosbbSyncResponse`).

## 2. Domain logic

- [x] 2.1 Create `lib/external-apis/moeosbb/mapper.ts` — `mapRemoteToClientFields(remote: MoeosbbRemoteClient)` maps `full_name→name`, `osbb_zkpo→legalId`, `legal_address→address`, `osbb_bank→bankName`, `osbb_rr→bankAccount`, `contract_email→email`. Returns partial Client update object.
- [x] 2.2 Create `lib/external-apis/moeosbb/sync.ts` — `runMoeosbbSync(singleClientId?: number)` orchestrator: fetch remote clients, match by `moeosbb_user_id`, selective merge, update `last_sync_at`, record `integration_health`. Optional `singleClientId` for per-client sync from card.
- [x] 2.3 Create `lib/external-apis/moeosbb/schedule.ts` — `shouldRunSync(schedule: string, today: Date): boolean` checks schedule rules (`first` = day 1, `last` = last day of month, `manual` = false).

## 3. MSW mock

- [x] 3.1 Create `tests/mocks/handlers/moeosbb.ts` — MSW handler for `MOEOSBB_SYNC_URL` returning fixture data with `{ ok: true, clients: [...] }`.

## 4. Unit tests

- [x] 4.1 Add tests for mapper in `tests/unit/moeosbb/mapper.test.ts` — field mapping, empty/null values.
- [x] 4.2 Add tests for schedule logic in `tests/unit/moeosbb/schedule.test.ts` — first/last/manual for various dates, edge cases (Feb 28/29, month boundaries).
- [x] 4.3 Add tests for client fetch in `tests/unit/moeosbb/client.test.ts` — success, 401, 500, invalid JSON (via MSW).

## 5. Cron handler

- [x] 5.1 Create `app/api/cron/moeosbb-sync/route.ts` — GET handler with `CRON_SECRET` guard, reads `moeosbb_sync_schedule` from settings, calls `shouldRunSync`, executes `runMoeosbbSync` if schedule matches.
- [x] 5.2 Register cron in `vercel.ts` — `{ path: "/api/cron/moeosbb-sync", schedule: "0 0 * * *" }`.

## 6. Server actions

- [x] 6.1 Add `triggerMoeosbbSyncAction()` to `app/(dashboard)/dashboard-actions.ts` — calls `runMoeosbbSync()` (full sync), returns `{ ok, error?, synced? }`.
- [x] 6.2 Add `syncSingleClientAction(clientId: string)` to `app/(dashboard)/clients/[id]/client-actions.ts` (or new file) — reads `moeosbb_user_id` from client, calls `runMoeosbbSync(moeosbbUserId)`, returns result.

## 7. UI

- [x] 7.1 Add "Синхронізувати Моє ОСББ зараз" button to dashboard page (`app/(dashboard)/page.tsx`) — calls `triggerMoeosbbSyncAction`, shows loading/success/error.
- [x] 7.2 Add "Синхронізувати" button to client card (`app/(dashboard)/clients/[id]/`) — visible only when `moeosbb_user_id IS NOT NULL`, calls `syncSingleClientAction`.

## 8. Environment

- [x] 8.1 Add `MOEOSBB_SYNC_URL` and `MOEOSBB_SYNC_TOKEN` to `.env.example` with descriptions.

## 9. QA

- [x] 9.1 Run `npm run qa` — all 6 gates must pass (lint, format:check, typecheck, test:run, build, openspec validate).

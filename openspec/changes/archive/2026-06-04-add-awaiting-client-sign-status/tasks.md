## 1. Schema & migration

- [x] 1.1 Add `waiting_for_client_sign` to `actStatusEnum` in `lib/db/schema/acts.ts` (logical position before `signed`)
- [x] 1.2 Export `EDO_PENDING_STATUSES = ["sent_to_edo", "waiting_for_client_sign"]`
- [x] 1.3 Generate migration; **trim** any re-emitted `acts`-table SQL, keep only `ALTER TYPE act_status ADD VALUE 'waiting_for_client_sign' BEFORE 'signed'`; bump journal timestamp; migrate dev (prod migrated separately per runbook)

## 2. Status mapper (single source of truth)

- [x] 2.1 New `lib/edo/dubidoc-status.ts` — pure `mapDubidocStatus(response) → { status?, edoStatus }`: `signed→signed`, `archived→deleted`, `refused→edo_status`, `new→sent_to_edo`, `waiting_for_contractor_sign→waiting_for_client_sign`, else→raw (status unchanged)
- [x] 2.2 Unit tests for every branch incl. unknown fallthrough and the `waiting_for_contractor_sign→waiting_for_client_sign` promotion

## 3. Polling & manual refresh

- [x] 3.1 `lib/edo/poll-dubidoc.ts` — use `mapDubidocStatus`; widen the select WHERE to `inArray(acts.status, EDO_PENDING_STATUSES)`; extend `PollResult` outcomes if needed
- [x] 3.2 `app/(dashboard)/acts/[id]/act-actions.ts` — replace the duplicated mapping with `mapDubidocStatus`
- [x] 3.3 Dashboard poll trigger path selects the same `EDO_PENDING_STATUSES` set (reuses `pollDubidocStatuses`)

## 4. UI — badges, filter, controls

- [x] 4.1 Label «Очікує підпису клієнта» + colour token (`bg-primary/12 text-primary`) in `acts/page.tsx`, `acts/[id]/page.tsx`, `clients/[id]/client-related.tsx`
- [x] 4.2 Add the value to `STATUS_ORDER` and the acts-list status filter
- [x] 4.3 `edo-controls.tsx` / `act-detail-panel.tsx` — show «Оновити статус» / «Перейти в Дубідок» + a dedicated banner for `waiting_for_client_sign`
- [x] 4.4 `lib/edo/vchasno-state.ts` — extend the `ActStatus` union (no new transitions)

## 5. Dashboard

- [x] 5.1 Add a fourth attention counter «Очікують підпису клієнта» = `countActsByStatus("waiting_for_client_sign")`, linking to `/acts?status=waiting_for_client_sign`; keep the existing `sent_to_edo` counter

## 6. Quality gate & verification

- [x] 6.1 `npm run qa` 6/6 green (incl. `openspec validate`)
- [x] 6.2 Manual dev smoke (verified 2026-06-04): act 05/2026, FOP-signed in DubiDoc, «Оновити статус» → badge «Очікує підпису клієнта» + banner «Ви підписали — очікує підпису клієнта». Real-behavior-proof: screenshot confirmed by operator.

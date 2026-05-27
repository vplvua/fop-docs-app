## 1. Domain logic

- [x] 1.1 Create `lib/edo/vchasno-state.ts` with `validateVchasnoTransition(currentStatus, targetStatus, edoProvider)` — returns `{ ok: true }` or `{ ok: false, error: string }`. Allowed: `draft → signed` and `signed → draft` for `vchasno_external` only.
- [x] 1.2 Add unit tests for vchasno state machine in `tests/unit/edo/vchasno-state.test.ts` — valid transitions, rejected transitions (wrong provider, wrong status), edge cases (deleted, sent_to_edo).

## 2. Server actions

- [x] 2.1 Add `markActSignedAction(actId)` to `app/(dashboard)/acts/[id]/act-actions.ts` — reads act, validates with `validateVchasnoTransition`, updates `status = signed`, `updatedAt = now()`.
- [x] 2.2 Add `unmarkActSignedAction(actId)` to `app/(dashboard)/acts/[id]/act-actions.ts` — reads act, validates with `validateVchasnoTransition`, updates `status = draft`, `updatedAt = now()`.

## 3. UI — act detail panel

- [x] 3.1 Add `MarkSignedButton` component to `act-detail-panel.tsx` — calls `markActSignedAction`, shows loading state, refreshes on success.
- [x] 3.2 Add `UnmarkSignedButton` component to `act-detail-panel.tsx` — calls `unmarkActSignedAction`, shows loading state, refreshes on success.
- [x] 3.3 Extend `EdoStatusBanners` with `vchasno_external` branches — "Очікує підпису у Вчасно" (draft + hasPdf), "Підписано у Вчасно" (signed).
- [x] 3.4 Wire new buttons into `ActDetailPanel` — show `MarkSignedButton` when `vchasno_external && status === draft`, show `UnmarkSignedButton` when `vchasno_external && status === signed`.

## 4. Tests

- [x] 4.1 Add unit tests for `markActSignedAction` and `unmarkActSignedAction` server action validation logic (provider/status guards) in `tests/unit/edo/vchasno-state.test.ts`.

## 5. QA

- [x] 5.1 Run `npm run qa` — all 6 gates must pass (lint, format:check, typecheck, test:run, build, openspec validate).

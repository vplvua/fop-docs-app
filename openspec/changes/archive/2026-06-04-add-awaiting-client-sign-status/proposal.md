## Why

A DubiDoc act sits in three distinct real-world states between send and full signature, but our `act_status` enum collapses the first two into `sent_to_edo`:

| DubiDoc raw status            | meaning                                 | our `status` today                       |
| ----------------------------- | --------------------------------------- | ---------------------------------------- |
| `new`                         | sent, **nobody** signed (FOP must sign) | `sent_to_edo`                            |
| `waiting_for_contractor_sign` | **FOP signed**, waiting for the client  | `sent_to_edo` (raw kept in `edo_status`) |
| `signed`                      | both signed                             | `signed`                                 |

The raw `waiting_for_contractor_sign` is already stored in `acts.edo_status`, but it does not drive the lifecycle, so the act card shows «Відправлено в ЕДО» even after the operator has personally signed and the only thing left is the client. The operator cannot tell «я ще маю підписати» from «я підписав, чекаю клієнта», and cannot filter/count acts stuck on the client. («contractor» у Дубідок = контрагент = наш клієнт.)

## What Changes

- **New act status `waiting_for_client_sign`** (badge «Очікує підпису клієнта»): the FOP has signed, the client has not. `sent_to_edo` retains its label «Відправлено в ЕДО» and now means specifically «надіслано, чекає мого підпису» (raw `new`).
- **Status mapping** gains `waiting_for_contractor_sign → waiting_for_client_sign`; `new` is mapped explicitly to `sent_to_edo` (was the generic fallthrough). `signed` / `archived` / `refused` / unknown-fallthrough are unchanged.
- **Polling must continue while `waiting_for_client_sign`** — the cron and dashboard-trigger queries widen from `status = sent_to_edo` to `status ∈ {sent_to_edo, waiting_for_client_sign}` (a single `EDO_PENDING_STATUSES` predicate), otherwise an act that reaches `waiting_for_client_sign` would never be re-polled and never reach `signed`.
- **Status→act mapper is extracted** into one pure function reused by the cron (`poll-dubidoc.ts`) and the manual «Оновити статус» action (`act-actions.ts`), which today duplicate the mapping.
- **UI**: badge + colour in the acts list, act detail, and client-related list; the new value joins the status filter and `STATUS_ORDER`; «Оновити статус» / «Перейти в Дубідок» controls also show for the new status.
- **Dashboard**: a **separate** attention counter «Очікують підпису клієнта» (`waiting_for_client_sign`) alongside the existing `sent_to_edo` counter, linking to `/acts?status=waiting_for_client_sign`.

## Capabilities

### Modified Capabilities

- `edo-dubidoc`: status mapping adds the owner-signed/awaiting-client state; the polling cron and the dashboard poll trigger select `status ∈ {sent_to_edo, waiting_for_client_sign}`; the manual refresh maps the new state via the shared mapper.
- `acts`: introduces the `waiting_for_client_sign` act status (badge «Очікує підпису клієнта»), filterable on the acts list and shown on the act detail badge.
- `dashboard`: a fourth attention counter for acts awaiting the client's signature.

## Impact

- **DB migration:** `ALTER TYPE act_status ADD VALUE 'waiting_for_client_sign'` (positioned before `signed`). Additive, no backfill — existing `sent_to_edo` rows whose `edo_status = "waiting_for_contractor_sign"` will promote on the next poll. Котиться на prod-гілку окремо (separate Neon branch); пильнувати re-emit таблиці `acts` у `db:generate`.
- **Code:**
  - `lib/db/schema/acts.ts` — new enum value + an `EDO_PENDING_STATUSES` constant.
  - `lib/edo/dubidoc-status.ts` (new) — pure `mapDubidocStatus(response) → { status?, edoStatus }`.
  - `lib/edo/poll-dubidoc.ts` — use the mapper; widen the WHERE to `EDO_PENDING_STATUSES`.
  - `app/(dashboard)/acts/[id]/act-actions.ts` — use the mapper (drop the duplicated branch).
  - `acts/page.tsx`, `acts/[id]/page.tsx`, `clients/[id]/client-related.tsx` — label + colour + `STATUS_ORDER` + filter.
  - `acts/[id]/edo-controls.tsx`, `act-detail-panel.tsx` — show refresh/link controls for the new status.
  - `(dashboard)/page.tsx` + dashboard counter loader — fourth counter.
  - `lib/edo/vchasno-state.ts` — extend the `ActStatus` union (vchasno transitions unaffected).
- **Safety:** the edit/delete/cancel-split guards are allowlists on `draft` (`isMutableAct`, `cancelSplit`), so the new status is locked automatically — no guard changes required.
- **No external API change.** Same `GET /documents/{id}` polling; only the raw→internal mapping and the poll-selection set change.

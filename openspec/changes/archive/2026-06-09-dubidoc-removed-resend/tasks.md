## 1. Status mapper (lib/edo/dubidoc-status.ts)

- [x] 1.1 Add a `status === "cancelled"` branch returning `{ status: "deleted", edoStatus: "cancelled" }`, placed before the signature-based branches
- [x] 1.2 Remove the `archived → { status: "deleted" }` branch so archived documents fall through to the signature-based derivation
- [x] 1.3 Update the fallback (`mapFromStateFallback`) and the doc-comment ordering note so `cancelled`/`refused` (not `archived`) take precedence
- [x] 1.4 Update `lib/external-apis/dubidoc/types.ts` `DocumentStatusResponse` to document `status` value `"cancelled"` and the optional `cancellationAct` field

## 2. Polling cron (lib/edo/poll-dubidoc.ts)

- [x] 2.1 In `applyStatusUpdate`, drop the payment-freeing block for `patch.status === "deleted"` (no `Payment.act_id = NULL`); also clear `edo_doc_id`/`edo_status`/`sent_to_edo_at` when marking `deleted`
- [x] 2.2 Change the 404 handler in `pollSingleAct` to set `Act.status = deleted` (keep the payment) instead of `resetActToDraft`; remove/repurpose `resetActToDraft`
- [x] 2.3 Keep the `deleted` outcome reporting in `PollResult`; confirm `deleted` acts stay excluded from the pending-acts query (`EDO_PENDING_STATUSES`)

## 3. Re-send (lib/edo/send-to-dubidoc.ts)

- [x] 3.1 Widen `shouldSkip` to allow `status ∈ {draft, deleted}` (still require dubidoc provider)
- [x] 3.2 Before `createDocument`, clear any stale `edo_doc_id`/`edo_status` so the prior hash is forgotten; confirm success path sets `sent_to_edo` with the new id and never auto-signs

## 4. Server actions (app/(dashboard)/acts/[id]/act-actions.ts)

- [x] 4.1 In `refreshDubidocStatusAction`, change the 404 path to set `Act.status = deleted` (keep payment) instead of resetting to `draft`
- [x] 4.2 Allow `regeneratePdfAction` and `updateServiceDescriptionAction` to operate on `status = deleted` acts (extend the `canEdit` guard to include `deleted`)
- [x] 4.3 Confirm `retryDubidocSendAction` works from `deleted` via the widened skip-guard

## 5. Act detail UI (app/(dashboard)/acts/[id]/act-detail-panel.tsx, page.tsx, edo-controls.tsx)

- [x] 5.1 Extend `canEdit`, `showRetry`, and the regenerate gating to include `status === "deleted"` for dubidoc acts
- [x] 5.2 Hide "Перейти в Дубідок" when `edo_doc_id` is null (already conditional on `edoDocId`); ensure removed acts without a hash do not render the link
- [x] 5.3 Add a "Видалено" status banner in `EdoStatusBanners` explaining the document was removed in DubiDoc and can be re-sent
- [x] 5.4 Confirm the `deleted` label/badge in `page.tsx` `STATUS_LABELS`/`STATUS_BADGES` still reads "Видалено"

## 6. Tests (tests/unit + integration)

- [x] 6.1 `mapDubidocStatus`: `status = "cancelled"` → `deleted`/`edoStatus "cancelled"`; `archived = true` + signed signatures → `signed` (NOT deleted)
- [x] 6.2 Poll: 404 → `deleted` with payment retained; `cancelled` → `deleted` with payment retained; no payment-freeing on any path
- [x] 6.3 Manual refresh: 404 → `deleted`, payment retained
- [x] 6.4 Re-send: a `deleted` act clears the old hash, creates a new document, lands `sent_to_edo`, payment unchanged
- [x] 6.5 Update/remove any existing test asserting `archived → deleted` or payment-freeing (FR-EDGE-01)

## 7. Refresh snapshots on regenerate (short name reaches DubiDoc title)

- [x] 7a.1 Add `lib/acts/refresh-snapshots.ts` — `refreshActSnapshots(actId)` rebuilds client + contract snapshots from the live client/contract (one contract per client)
- [x] 7a.2 Call it from `regeneratePdfAction` for editable acts (`status ∈ {draft, deleted}`) before rendering; never for sent/signed acts
- [x] 7a.3 Unit test: editable act re-snapshots (picks up a newly-set short name); sent/signed act is left untouched

## 8. Quality gate & archive

- [x] 8.1 Run `npm run qa` (lint → format → typecheck → test → build → openspec validate) and fix failures
- [x] 8.2 Verify against the live cancelled doc `790365f6-…` (manual refresh → status becomes "Видалено", re-send creates a new hash) — verified by user on dev

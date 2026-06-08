## Why

When a DubiDoc document is removed, the app either mishandles it or misreads it. A **cancelled** (анульовано) document — signed, then voided by a cancellation act — has top-level `status = "cancelled"`, which the mapper never reads, so the act is mislabeled `waiting_for_client_sign` (verified on doc `790365f6-…`). A **deleted** (unsigned) document returns HTTP 404 and is silently reset to `draft`, indistinguishable from "never sent". And `archived = true` — which is actually a **normal signed document filed into an archive folder**, not a removal — is wrongly treated as a deletion that detaches the payment and spawns a duplicate act. The admin needs to see that a document is gone and re-send a fresh copy, while genuinely archived (signed) documents stay put.

## What Changes

- Add a **«Видалено» (removed)** detection: top-level `status = "cancelled"` → `Act.status = deleted`, keeping the act and its payment attached.
- The HTTP **404** path (deleted-unsigned) maps to `Act.status = deleted` (was: silent `draft`), also keeping the payment.
- **BREAKING (behavior):** stop treating `archived = true` as a deletion. Archived documents derive their status normally via the signature-based mapper (→ `signed`); the payment is **not** freed and no re-send is offered.
- **BREAKING (behavior):** remove payment-freeing / re-classification on removal (retires FR-EDGE-01). A removed act keeps `Payment.act_id`; the payment ↔ act pairing is preserved.
- A «Видалено» act gains **draft-like affordances** — edit service description, edit manual act (when eligible), regenerate PDF with fresh snapshots — **plus** a "Надіслати в Дубідок" re-send button.
- **Re-send** forgets the old hash (`edo_doc_id = NULL`, `edo_status = NULL`), regenerates the PDF from the act's current snapshots, creates a **new** DubiDoc document, and lands the act in `sent_to_edo` with no auto-sign.
- Removed acts (`status = deleted`) are **not polled** until re-sent (they are already excluded from `EDO_PENDING_STATUSES`); after re-send the new hash resumes polling.

## Capabilities

### New Capabilities

<!-- none -->

### Modified Capabilities

- `edo-dubidoc`: status mapping gains a `cancelled → deleted` branch and drops the `archived → deleted` branch (archived derives normally → `signed`); the 404 path maps to `deleted` (payment retained) instead of `draft`; the FR-EDGE-01 "archived releases payment for re-classification" requirement is removed; a new requirement covers re-sending a removed act (forget hash → regenerate → new document → `sent_to_edo`); the manual-retry and edit/regenerate affordances extend to `status = deleted`.

## Impact

- **Spec:** `openspec/specs/edo-dubidoc/spec.md` — modify "DubiDoc status mapping", remove "Archived act releases payment for re-classification", extend "Manual retry for failed DubiDoc send", add "Re-send removed act to DubiDoc" and "Removed-document detection".
- **Code:**
  - `lib/edo/dubidoc-status.ts` — drop `archived` branch; add `cancelled` branch → `deleted`.
  - `lib/edo/poll-dubidoc.ts` — `deleted` outcome no longer frees the payment; 404 path sets `deleted` (keep payment) instead of resetting to `draft`.
  - `lib/edo/send-to-dubidoc.ts` — skip-guard accepts `status = deleted`; clear stale `edo_doc_id`/`edo_status` before creating the new document.
  - `app/(dashboard)/acts/[id]/act-actions.ts` — manual-refresh 404 path → `deleted` (keep payment); allow regenerate/edit on `deleted`.
  - `app/(dashboard)/acts/[id]/act-detail-panel.tsx` — `canEdit`, `showRetry`, regenerate affordances include `deleted`.
  - `lib/external-apis/dubidoc/types.ts` — `DocumentStatusResponse` documents `status = "cancelled"` (and optional `cancellationAct`).
- **DB:** no schema/migration change — `deleted` already exists in `act_status`; label stays "Видалено".
- **Tests:** unit coverage for `mapDubidocStatus` (cancelled → deleted; archived → signed, not deleted); poll/refresh 404 → deleted with payment retained; re-send clears hash and re-creates.

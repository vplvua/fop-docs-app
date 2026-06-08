## Context

DubiDoc has two ways to remove an erroneous document:

1. **Delete** (only before signing) — the document ceases to exist; `GET /documents/{id}` returns HTTP 404.
2. **Cancel / анулювати** (after signing) — a cancellation act is signed; the original document survives but its top-level org-relative `status` becomes `"cancelled"` (and a `cancellationAct` is attached). `state` stays `sent`, `archived` stays `false`.

`archived = true` is **not** a removal — it is a normal, signed document moved into an archive folder.

Current behavior (`lib/edo/dubidoc-status.ts`, `lib/edo/poll-dubidoc.ts`, `act-actions.ts`):

- `archived = true` → `Act.status = deleted` **and frees the payment** (`Payment.act_id = NULL`, `Payment.status = received`), which re-classifies the payment into a _duplicate_ act. Wrong: the archived document is real and signed.
- `status = "cancelled"` → not read; falls through to the signature branches → mislabeled `waiting_for_client_sign`.
- HTTP 404 → silently reset to `draft` (payment kept), indistinguishable from "never sent".

The admin's mental model: a payment has exactly one corresponding act. If the DubiDoc copy is gone (deleted or cancelled), keep the act+payment and let me re-send a fresh copy. History of prior DubiDoc documents does not matter.

## Goals / Non-Goals

**Goals:**

- Detect a removed DubiDoc document (404 or `cancelled`) and surface it as a single visible state `deleted` / "Видалено", keeping the act and its payment attached.
- Let the admin re-send a removed act to DubiDoc (new document, new hash) from the act detail page, with no auto-sign.
- Give a removed act the same draft-like edit/regenerate affordances so a corrected document can be re-sent.
- Stop misclassifying archived (signed) documents as removed.

**Non-Goals:**

- Deleting or cancelling documents from within the app — those are rare and done in DubiDoc directly; the app only learns about them.
- Keeping any history of previously-sent DubiDoc documents.
- A dedicated "cancelled" vs "deleted" distinction — one status covers both; the reason a document is gone does not matter.
- Auto-pulling fresh client/contract data inside the re-send action itself — re-send uses the act's current snapshots. Refreshing snapshots from the live client/contract is the job of the explicit "Перегенерувати PDF" step (editable acts only), which the admin performs first when data changed; re-send then sends whatever the snapshots hold.

## Decisions

### D1 — Reuse the existing `deleted` status; relabel meaning, keep the "Видалено" label

`act_status` already has `deleted`. Both removal triggers (404, `cancelled`) map to it. No enum change, no migration. Its _meaning_ shifts from "act voided, payment re-classified" to "DubiDoc copy gone; act + payment retained; re-send available". The UI label stays "Видалено".

_Alternative considered:_ a new `edo_removed` enum value. Rejected — requires a migration and adds a status the admin explicitly said is unnecessary ("достатньо одного статусу").

### D2 — `cancelled` detection via top-level `status`

`mapDubidocStatus` gains an early branch: `status === "cancelled"` → `{ status: "deleted", edoStatus: "cancelled" }`. Placed alongside the other overrides, before the signature-based branches (since a cancelled act has the FOP signed and would otherwise resolve to `waiting_for_client_sign`/`signed`). `cancellationAct` is documented on the type but `status === "cancelled"` is the authoritative signal.

### D3 — Remove the `archived` branch entirely

Delete `if (detail.archived) return { status: "deleted", … }`. Archived documents fall through to the normal signature-based derivation and resolve to `signed`. The "Archived act releases payment for re-classification" requirement (FR-EDGE-01) is removed — payment-freeing on removal is gone from all paths.

### D4 — 404 maps to `deleted`, payment retained

Both the poll (`pollSingleAct`) and the manual refresh currently reset a 404'd act to `draft` with a cleared hash. Change both to set `Act.status = deleted`, clear `edo_doc_id`/`edo_status`/`sent_to_edo_at`, and **keep** `Payment.act_id`. The removed state is now visible and distinct from a never-sent draft.

### D5 — Re-send reuses `sendActToDubidoc` with a widened skip-guard

`shouldSkip` currently requires `status === "draft" && edoDocId === null`. Widen it to also allow `status === "deleted"`, and before creating the new document clear any stale `edo_doc_id`/`edo_status` ("forget the hash"). The existing success path already sets `sent_to_edo` and never auto-signs, satisfying the "I'll sign later" scenario. `regeneratePdfAction` (which auto-resends for dubidoc) thus also works from `deleted`.

### D6 — Draft-like affordances for `deleted` acts in the UI

In `act-detail-panel.tsx`, extend the predicates so a `deleted` dubidoc act shows: edit service description / edit manual act (when eligible), "Перегенерувати PDF", and "Надіслати в Дубідок". `canEdit`, `showRetry`, and the regenerate gating all include `status === "deleted"`. The "Перейти в Дубідок" link is hidden once `edo_doc_id` is cleared.

## Risks / Trade-offs

- **A `cancelled` act briefly mislabeled before the next poll** → the next poll/manual refresh applies the new branch and corrects it; the offending act in production is currently `waiting_for_client_sign` and will self-heal once deployed.
- **Re-send sends stale snapshots if the admin forgot to fix the error first** → by design; corrections are an explicit manual edit/regenerate step. The draft-like affordances make that step available on the same page.
- **`deleted` now means two different things historically** → no acts are currently in `deleted` status (confirmed with the admin), so there is no stale data to migrate or reinterpret.
- **An archived-but-not-yet-fully-signed document** would now stay pending and keep polling instead of being marked removed → acceptable; archiving an unsigned document is not an expected workflow, and the signature mapper still resolves it correctly once signed.

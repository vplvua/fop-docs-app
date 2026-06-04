## Why

Manual import (statement-by-date) triggers classification **fire-and-forget** — `importStatementTransactionAction` inserts the payment, calls `runClassification(paymentId)` without `await`, and immediately returns `{ paymentId }` so the UI can `router.push('/payments/[id]')` (`app/(dashboard)/payments/import/actions.ts:156`, `statement-import.tsx:68`). The payment detail page is a server component that reads `payments.status` at render time. While the background classification is still in flight, that read returns the pre-classification status (`received`), so the page renders the «Класифікувати» button.

The operator clicks it. `classifyPaymentAction` passes its pre-transaction guard (status is still `received`) and starts a **second** `runClassification`. Inside the transaction, `SELECT … FOR UPDATE` (FR-CLASS-15) blocks on the first run's row lock; once the first run commits (`status = classified`, act created), the second run re-reads the row and `fetchClassificationData` throws `Payment <id> is already classified` (`lib/classification/run-classification.ts:30-32`). The act was created correctly by the first run — only the second, manual trigger surfaces a red error in the panel. After a reload the page shows the act (Image #2 in the report).

This only happens on **manual import** because that path is the one that both (a) fires classification without awaiting it and (b) navigates the operator straight onto the payment page, opening a tight race window where a human is looking at the redundant button. Cron polling (`app/api/cron/privatbank-poll/route.ts:8`) awaits classification and never routes a user there mid-flight.

The `FOR UPDATE` serialization is working as intended — it correctly prevents a duplicate act. The defect is the **second writer's reaction**: it throws an error instead of recognising the work is already done.

## What Changes

- **`runClassification` becomes idempotent.** When the payment row, locked under `FOR UPDATE`, is already in a terminal classification state (`classified` or `skipped`), the run SHALL NOT throw, SHALL NOT create a second act, and SHALL NOT re-trigger PDF generation. It SHALL return a no-op result identifying the existing terminal status. The legitimate reclassify states (`received`, `awaiting_review`, `in_queue`) are unaffected.
- **The classify action treats "already classified" as success.** `classifyPaymentAction` maps a no-op run — and a pre-transaction status that is already `classified` — to `{ ok: true }`, so the panel simply refreshes into the read-only classified view (showing the act). It no longer renders the `Payment … is already classified` error. `skipped` stays rejected by the action (skip is terminal for classification by design — FR-CLASS-18).
- **The manual-link action gets the same no-op handling.** `linkPaymentClientAction` maps a no-op run to `{ ok: true }`.
- **No change to the trigger mechanism.** Manual import stays fire-and-forget (responsive UX); the briefly-shown button is now harmless because the action it triggers is a safe no-op.

## Capabilities

### Modified Capabilities

- `classification`: the outcome of a concurrent / redundant classification trigger on an already-finalised payment is now an **idempotent no-op success**, not a thrown error. The `FOR UPDATE` serialization and the "classified is not reclassifiable / no second act" guarantees are unchanged — only the second writer's reaction (and the server action's response to it) changes.

## Impact

- **Refines:** FR-CLASS-15 (transaction + `FOR UPDATE` serialization) — defines the second-writer outcome as an idempotent no-op; FR-CLASS-17 (classified not reclassifiable) — preserved (still no second act), but invoking classify on an already-classified payment is now a no-op success rather than an error. No new ADR.
- **DB:** no migration. Reads the same `payments` row under the existing `FOR UPDATE`.
- **External APIs:** none.
- **Code:**
  - `lib/classification/run-classification.ts` — `fetchClassificationData` (or a status pre-check inside the locked transaction) returns a terminal-state sentinel instead of throwing; `classifyPaymentInTx` short-circuits to a no-op (no act insert, no status write); `runClassification` returns `ClassificationResult | null` (`null` = no-op) and skips `generateAndStoreActPdf` on a no-op.
  - `app/(dashboard)/payments/[id]/classification-actions.ts` — `classifyPaymentAction` returns `{ ok: true }` for a no-op run and for a pre-transaction `classified` status; `linkPaymentClientAction` returns `{ ok: true }` for a no-op run.
- **Tests:** unit/integration covering (1) two concurrent `runClassification` calls → exactly one act, the second resolves to `null` without throwing; (2) `classifyPaymentAction` on an already-`classified` payment → `{ ok: true }`, no second act.

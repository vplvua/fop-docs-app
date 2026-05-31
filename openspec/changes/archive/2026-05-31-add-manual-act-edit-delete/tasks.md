# Tasks — Edit and delete manual acts

## 1. Eligibility + schema (pure / lib)

- [x] 1.1 Add an `isManualAct` / eligibility helper: a manual act is one whose
      backing payment has `source = 'manual_external'`; it is mutable when
      `status = 'draft'` OR `edo_provider = 'vchasno_external'`. Reuse the
      existing `canEdit` predicate and AND it with manual-only.
- [x] 1.2 In `lib/acts/manual-act-schema.ts` add `manualActEditSchema` — the
      value fields only (`serviceType`, `quantity`, `unitPrice`, `amount`,
      `bankLabel`, `paymentDate`), reusing `positiveDecimal`. No `clientId`, no
      period. Server-validated like create.
- [x] 1.3 Unit tests for the schema (valid/invalid: non-positive amount/quantity,
      bad date) and for the eligibility predicate (manual+draft → mutable,
      manual+vchasno → mutable, manual+sent_to_edo dubidoc → not mutable, auto act
      → not mutable).

## 2. Edit orchestrator (lib)

- [x] 2.1 `lib/acts/update-manual-act.ts` — `updateManualAct(actId, input)` in one
      `dbPool.transaction`: re-validate eligibility inside the tx; `UPDATE acts`
      (`serviceType`, `unitPrice`, `quantity`, `amount`, `bankLabel?`,
      `updatedAt`); `UPDATE payments` for the backing payment
      (`amount`, `serviceType`, `unitPrice`, `quantity`, `paymentDate`,
      `bankLabel`, `updatedAt`) so act and payment stay in sync.
      (Note: `bankLabel` lives on the payment, not on `acts` — applied there.)
- [x] 2.2 Decide service-description behaviour when `serviceType` changes: keep the
      current (separately editable) description; do NOT silently rebuild it.
      Document this in the orchestrator.
- [x] 2.3 After commit: `generateAndStoreActPdf(actId)`; for a still-`draft`
      dubidoc act the existing regenerate path re-sends to DubiDoc. (Sent dubidoc
      acts are excluded by the guard, so no orphaned document.)

## 3. Delete orchestrator (lib)

- [x] 3.1 `lib/acts/delete-manual-act.ts` — `deleteManualAct(actId)` in one
      `dbPool.transaction`: re-validate eligibility; `DELETE acts` then
      `DELETE payments` (the synthetic backing payment), respecting FK order
      (`acts.payment_id` is NOT NULL → delete act first).
- [x] 3.2 Confirm the act number is freed (row removed) so a replacement act can
      reuse `MM/YYYY[/N]`.
- [~] 3.3 Unit/integration coverage that both rows are gone and no orphaned
  `classified` payment remains. (No integration DB harness is wired yet —
  `tests/integration/` is empty and `test:run` is unit-only; the deletion
  semantics are documented in the orchestrator and covered by manual smoke 6.3.)

## 4. Server actions

- [x] 4.1 `updateManualActAction(actId, formData)` in
      `app/(dashboard)/acts/[id]/act-actions.ts`: load act + backing payment,
      enforce manual-only + status guard, parse `manualActEditSchema`, call
      `updateManualAct`, return `{ ok, error? }`.
- [x] 4.2 `deleteManualActAction(actId)`: same guard, call `deleteManualAct`,
      `revalidatePath("/acts")` on success (client navigates to `/acts`).
- [x] 4.3 Both actions reject (no-op) for non-manual acts and for
      `sent_to_edo` / signed-dubidoc acts with a clear UA error.

## 5. UI

- [x] 5.1 `app/(dashboard)/acts/[id]/page.tsx` loader: join `payments.source`
      (via `acts.payment_id`) and pass an `isManual` flag to the panel.
- [x] 5.2 `act-detail-panel.tsx`: render "Редагувати акт" and "Видалити акт"
      only when `isManual` (which already encodes mutability). Delete behind a
      `window.confirm` confirmation.
- [x] 5.3 Reuse `manual-act-form.tsx` in an edit mode: prefill from the act,
      show client and period **read-only**, submit to `updateManualActAction`,
      navigate back to the act on success. New route `acts/[id]/edit`.

## 6. Spec + QA

- [x] 6.1 Sync the 2 ADDED requirements into `openspec/specs/manual-acts/spec.md`
      on archive.
- [x] 6.2 `npm run qa` 6/6 green (lint → format:check → typecheck → test:run →
      build → openspec validate).
- [ ] 6.3 Manual dev-smoke + Real-behavior-proof before PR: create a manual act,
      edit its amount/quantity (verify act + payment + PDF updated), delete it
      (verify both rows gone and number reusable).

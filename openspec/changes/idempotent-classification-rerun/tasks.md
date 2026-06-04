## 1. Idempotent `runClassification`

- [x] 1.1 In the locked transaction (`fetchClassificationData` / `classifyPaymentInTx`), when the `FOR UPDATE`-locked payment has `status ∈ {classified, skipped}`, return a no-op marker instead of throwing — no `classify()` call, no act insert, no payment write
- [x] 1.2 `runClassification` returns `ClassificationResult | null` (`null` = no-op); on `null` skip `generateAndStoreActPdf`; add JSDoc explaining `null` means the payment was already terminal
- [x] 1.3 Audit callers for the `| null` widening: server actions and import ignore the value (non-breaking); the cron poll reads `r.value.status` to count classified-this-run — guard with `r.value?.status` so a no-op is not counted

## 2. Action layer

- [x] 2.1 `classifyPaymentAction`: return `{ ok: true }` when the pre-transaction status is already `classified`, and when `runClassification` returns `null`; keep rejecting `skipped`; keep surfacing genuine `runClassification` errors
- [x] 2.2 `linkPaymentClientAction`: return `{ ok: true }` when `runClassification` returns `null`

## 3. Tests

> **DEFERRED (decision 2026-06-04).** Both items require a live-Postgres concurrency test. The repo has only the unit harness (Vitest + happy-dom); there is no `tests/integration/` D-038 harness yet, and AGENTS.md forbids mocking the DB. The idempotency logic lives entirely in the `FOR UPDATE` status check, so there is no pure function to unit-test in isolation. Coverage is provided by the manual dev smoke (4.2), consistent with the sibling `constrain-split-to-payer-edrpou` change. Re-enable these when the D-038 integration harness lands.

- [ ] 3.1 Integration: two concurrent `runClassification` calls on the same `received` payment → exactly one act created, the second resolves to `null` (no throw)
- [ ] 3.2 Integration/unit: `classifyPaymentAction` on an already-`classified` payment → `{ ok: true }`, no second act; on a `skipped` payment → `{ ok: false }` (unchanged)

## 4. Quality gate & verification

- [x] 4.1 `npm run qa` green (lint → format:check → typecheck → test:run → build → openspec validate)
- [ ] 4.2 Manual dev smoke (Real behavior proof): import a payment via statement-by-date and click «Класифікувати» during the race window → no `is already classified` error, panel refreshes to the act; reload confirms a single act. Capture verification log / screenshot for the PR

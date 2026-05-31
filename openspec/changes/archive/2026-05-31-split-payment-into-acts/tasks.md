## 1. Decision record & constraints

- [x] 1.1 Add ADR **D-042** «Розділення платежу на кілька актів (ручне)» with `**Переглядає:** D-007`; append it to `docs/adr/README.md` index
- [x] 1.2 Reword the `openspec/project.md` non-negotiable bullet «One payment ↔ one act (D-007). No bundling, no split.» to the `Σ(act.amount) == payment.amount` split invariant (cite D-042)
- [x] 1.3 Confirm **no DB migration** is needed (`acts.payment_id` NOT NULL & non-unique; `payments.act_id` nullable) — record the check

## 2. Split orchestrator (lib)

- [x] 2.1 Add `lib/acts/split-payment.ts` exporting `splitPayment(paymentId, lines[])`: one `dbPool.transaction` — load+lock payment, validate `Σ(line.amount) == payment.amount` (decimal compare), per line `nextActNumber` → `buildActStub` (existing `payment.id`) → `fopSnapshot` → insert act, then payment → `classified` + `act_id = firstAct.id`
- [x] 2.2 After commit, fire `generateAndStoreActPdf(actId)` per created act (auto-sends to EDO); failures leave that act `draft` / `pdf_file_url = NULL`
- [x] 2.3 Add `cancelSplit(paymentId)`: only if every linked act is `draft` — delete all linked acts and restore the payment's pre-split status (skipped→skipped, else received); block if any linked act is `sent_to_edo`/`signed`
- [x] 2.4 Record the pre-split status so cancel is a true undo (`split_origin:<status>` on `classification_reason`); `act_date = lastDayOfMonth(line month)` per line. Also guards `delete/update-manual-act` against split acts (shared payment)

## 3. Validation & pricing hint

- [x] 3.1 Zod schema for the split form: `paymentId`, `lines[]` (each: clientId with contract, period month+year, service type, quantity > 0, amount > 0), `len(lines) >= 1`
- [x] 3.2 Server-side reconciliation guard: `reconcilesExactly` compares in integer kopiykas; rejected with a clear message otherwise
- [x] 3.3 Reuse the per-line tariff hint (`suggestManualActPricing`) for unit price + default quantity (overridable)
- [x] 3.4 Unit tests: reconciliation pass/fail incl. rounding boundaries (6460 = 1000 + 5460; 3-way; off-by-0.01 reject), schema valid/invalid, split-origin marker + pre-split status restore

## 4. Server actions & loaders

- [x] 4.1 `splitPaymentAction(formData)`: Zod-validate → `splitPayment` → return created act ids (never trust client-supplied prices without server validation)
- [x] 4.2 `cancelSplitAction(paymentId)`: guard draft-only → `cancelSplit`
- [x] 4.3 Reuse the clients-with-contract picker loader from `manual-acts`; expose linked-acts-for-payment via `acts WHERE payment_id = …`
- [ ] 4.4 Integration smoke (Neon test DB) when harness exists: split a real payment → N acts linked to the same payment, payment `classified`, `Σ` matches — deferred to S2+ per `add-manual-act` precedent; covered by the dev smoke in 6.3

## 5. UI — «Розділити на акти»

- [x] 5.1 On `/payments/[id]`, add a «Розділити на акти» action for `received`/`awaiting_review`/`in_queue`/`skipped`; opens the N-line split form at `/payments/[id]/split`
- [x] 5.2 Each line: searchable contract-only client picker (reused `ClientCombobox`), period month/year, service, quantity, amount (tariff-hinted, overridable); add/remove line
- [x] 5.3 Running «Розподілено X / Y · Залишок Z» indicator; submit disabled until `Σ == payment.amount` and all lines valid; inline validation errors
- [x] 5.4 Classification payment-card: a `classified` payment lists **all** linked acts; a `skipped` payment shows the «Розділити на акти» action
- [x] 5.5 «Скасувати розділення» action on a split-backed payment, shown only while all linked acts are `draft` (server re-checks)
- [x] 5.6 DESIGN.md tokens for form/badges/summary (token classes only, design-token guard green); empty/disabled states

## 6. Quality gate & verification

- [x] 6.1 Unit tests green (reconciliation, schema, split-origin marker / pre-split status)
- [x] 6.2 `npm run qa` all gates green (lint → check:design → format:check → typecheck → test:run → build → openspec:validate)
- [ ] 6.3 Manual smoke on dev Neon branch: split the Великошпанівське-style 6460 `skipped` payment into access 1000 + sms 5460 → two acts linked to the one real payment, payment `classified`, payments list no longer double-counts; cancel-split returns to `skipped`; capture Real-behavior-proof for the PR

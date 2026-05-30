## 1. Prerequisite

- [x] 1.1 Confirm `add-privatbank-statement-by-date` is implemented/applied (provides `payments.source` + `bank_label`); no schema migration in this change

## 2. Manual act orchestrator (lib)

- [x] 2.1 Add a synthetic-id helper `manualBankTransactionId()` returning `manual:{uuid}`
- [x] 2.2 Add `lib/acts/create-manual-act.ts` exporting `createManualAct(input)`: in one `dbPool.transaction` — insert backing payment (`source='manual_external'`, synthetic id, payer from client, optional `bank_label`), `nextActNumber`, `buildActStub` from admin inputs, set `fopSnapshot` from `getFopRequisites()`, insert act, update payment → `classified` + `act_id`
- [x] 2.3 After commit, fire `generateAndStoreActPdf(actId)` (auto-sends to DubiDoc) — fire-and-forget, failure leaves act `draft`/`pdf_file_url=NULL`
- [x] 2.4 Use `lastDayOfMonth(periodMonth)` for `act_date`, decoupled from payment date

## 3. Validation & pricing hint

- [x] 3.1 Add a Zod schema for the manual-act form (client id, period month+year, service type, quantity > 0, amount > 0, optional bank_label, optional payment date)
- [x] 3.2 Add a tariff-hint helper using `resolveAccessPrice` / `resolveSmsPrice` to suggest unit price + default quantity for the selected client/service
- [x] 3.3 Unit tests: schema (valid/invalid), synthetic-id format/uniqueness, period→act_date mapping, amount-as-entered (not recomputed)

## 4. Server action & data loaders

- [x] 4.1 Add a client-with-contract loader for the picker (only clients that have a contract)
- [x] 4.2 Add `createManualActAction(formData)`: Zod-validate → `createManualAct` → return created act id; never trust client-supplied price without server validation
- [ ] 4.3 Integration smoke (Neon test DB): manual act creates backing payment + linked act with correct number/snapshots — deferred: no integration harness yet (S2+); covered by the manual dev smoke in 6.3

## 5. UI — «Створити акт вручну»

- [x] 5.1 New page in the acts route group with the form (client selector, period month/year, service, quantity, amount, optional bank label)
- [x] 5.2 Wire tariff hint: on client/service change pre-fill unit price + default quantity (overridable), compute amount = price × quantity until overridden
- [x] 5.3 Submit via server action; on success navigate to `/acts/{id}`; surface validation errors inline
- [x] 5.4 DESIGN.md tokens for form/badges; empty/disabled states; entry point link from the acts area

## 6. Quality gate & verification

- [x] 6.1 Unit tests green (schema, helpers, orchestrator pure parts)
- [x] 6.2 `npm run qa` 6/6 (lint → format:check → typecheck → test:run → build → openspec validate)
- [ ] 6.3 Manual smoke on dev Neon branch: create a manual act (other-bank case) → backing payment + act + PDF + DubiDoc send; verify period decoupling and amount-as-entered; capture Real-behavior-proof for PR

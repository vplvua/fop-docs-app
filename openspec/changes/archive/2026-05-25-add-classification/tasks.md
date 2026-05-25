## 1. DB Schema & Migration

- [x] 1.1 Create `lib/db/schema/acts.ts` — `act_status` pgEnum (draft, sent_to_edo, signed, deleted), `acts` table with all columns per spec (id, client_id FK RESTRICT, payment_id, status, service_type, unit_price, quantity, quantity_unit, act_date, number, client_snapshot, contract_snapshot, service_description, edo_provider, pdf_file_url, edo_doc_id, edo_status, sent_to_edo_at, created_at, updated_at), UNIQUE index on (client_id, act_date, number)
- [x] 1.2 Add FK from `payments.act_id` to `acts.id` with ON DELETE SET NULL (alter payments schema)
- [x] 1.3 Create SQL migration `0009_add_acts.sql` and apply via `npm run db:migrate`
- [x] 1.4 Export acts schema from `lib/db/schema/index.ts`

## 2. Pure Classification Pipeline

- [x] 2.1 Create `lib/classification/types.ts` — `ClassificationResult` discriminated union (success with act data | awaiting_review with reason | in_queue with reason | skip), `ClassificationInput` type, reason constants
- [x] 2.2 Create `lib/classification/parse-contract-numbers.ts` — apply regex patterns array to purpose, deduplicate results
- [x] 2.3 Create `lib/classification/match-client.ts` — two-factor matching (contract + legal_id), transit EDRPOU bypass, fallback by legal_id only
- [x] 2.4 Create `lib/classification/detect-service-type.ts` — keyword-based SMS detection from purpose
- [x] 2.5 Create `lib/classification/check-completeness.ts` — verify required client/contract fields, apartments_count logic for access without override
- [x] 2.6 Create `lib/classification/resolve-quantity.ts` — access: amount/price divisibility check; SMS: parse quantity from purpose, validate quantity × price = amount
- [x] 2.7 Create `lib/classification/classify.ts` — orchestrate steps 1-8 as pure function: parse → dedup → match → auto_act_disabled → edo_provider → service_type → completeness → price+quantity. Return ClassificationResult
- [x] 2.8 Create `lib/classification/act-stub.ts` — build act stub data (snapshots, act_date as last day of payment month, number generation query, service_description template)

## 3. Classification Orchestrator (DB layer)

- [x] 3.1 Create `lib/classification/run-classification.ts` — fetch all needed data (payment FOR UPDATE, client, contract, settings, tariffs, sms_prices), call pure pipeline, write results to DB (update payment, create act stub if success), all in a single Postgres transaction
- [x] 3.2 Integrate classification trigger into PrivatBank polling — call `runClassification(paymentId)` for each newly inserted payment in `app/api/cron/privatbank-poll/route.ts`

## 4. Server Actions

- [x] 4.1 Create `app/(dashboard)/payments/[id]/classification-actions.ts` — `classifyPaymentAction(paymentId)` server action: validate payment status is reclassifiable, call `runClassification`
- [x] 4.2 Create `skipPaymentAction(paymentId)` in same file — validate status is not classified/skipped, set status to skipped

## 5. UI — Payment Card Action Panel

- [x] 5.1 Create `app/(dashboard)/payments/[id]/classification-panel.tsx` — conditional action panel component: classify/skip buttons for actionable statuses, reason details for in_queue/awaiting_review, act link for classified, badge for skipped
- [x] 5.2 Integrate classification panel into existing payment detail page (`/payments/[id]`)
- [x] 5.3 Add reason-specific guidance text (no_match, multiple_contracts, ambiguous_client, client_incomplete, amount_mismatch, sms_quantity_mismatch, auto_act_disabled, external_edo)

## 6. Unit Tests

- [x] 6.1 Tests for `parse-contract-numbers` — single match, multi-pattern same number, no match, multiple different numbers
- [x] 6.2 Tests for `match-client` — contract+legal_id match, ambiguous_client, fallback by legal_id, no_match, transit EDRPOU bypass (match and no-match)
- [x] 6.3 Tests for `detect-service-type` — SMS keyword hit, no keyword defaults to access, case-insensitive
- [x] 6.4 Tests for `check-completeness` — all fields present, missing email, missing bank_name, missing contract, access without apartments_count (no override vs with override)
- [x] 6.5 Tests for `resolve-quantity` — access divisible, access not divisible, SMS parsed and valid, SMS unparseable, SMS quantity×price mismatch
- [x] 6.6 Tests for `classify` (full pipeline) — happy path access, happy path SMS, all 8 reason branches (no_match, multiple_contracts, ambiguous_client, client_incomplete, auto_act_disabled, external_edo, amount_mismatch, sms_quantity_mismatch), priority of auto_act_disabled over external_edo
- [x] 6.7 Tests for `act-stub` — act_date last day of month calculation, service_description templates, snapshot shape

## 7. Validation & QA

- [x] 7.1 Run `npm run qa` — all 6 gates green (lint, format, typecheck, test, build, openspec validate)
- [x] 7.2 Manual smoke: create client + contract + payment via UI → trigger classify → verify status transitions and act stub creation

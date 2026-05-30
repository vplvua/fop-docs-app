## Context

Acts are produced today only by automatic classification of a polled PrivatBank transaction (`lib/classification/run-classification.ts`): it locks the payment, runs `classify()`, builds an act stub via `buildActStub`, assigns a number with `nextActNumber` (`SELECT ... FOR UPDATE`), snapshots FOP requisites, inserts the act, marks the payment `classified` + `act_id`, and fires PDF generation (which auto-sends to DubiDoc). Every downstream step keys off `actId`, not the payment — so the act pipeline is already payment-agnostic past stub assembly.

The domain invariant is "every act is backed by a payment" (`acts.payment_id NOT NULL`), because all payments are prepayments. The gap is acts for money that never reached the app: other-bank payments and pre-launch payments. This change adds a manual path that creates a backing payment and an act in one operation, reusing the existing assembly/numbering/PDF/EDO machinery but taking service/quantity/amount/period from admin input instead of deriving them from the payment.

Depends on `add-privatbank-statement-by-date`, which introduces `payments.source` (`'privatbank' | 'manual_external'`) and `bank_label`. Constraints unchanged: `lib/` pure; MSW for HTTP; real Neon test DB; dev/prod separate Neon branches.

## Goals / Non-Goals

**Goals:**

- One admin form: client (with contract) → period month → service → quantity → amount (tariff-hinted, overridable) → create act → send to DubiDoc.
- Preserve the act-always-has-a-payment invariant by creating a backing `manual_external` payment.
- Decouple act period from payment date.
- Reuse `buildActStub`, `nextActNumber`, FOP snapshot, PDF, and DubiDoc send verbatim — no second numbering or PDF path.

**Non-Goals:**

- PrivatBank by-date import (that is the sibling change).
- Editing/voiding manual payments as a general feature beyond what acts already support.
- Auto-classification of manual payments — manual acts deliberately bypass `classify()`.
- New EDO behavior — reuse existing DubiDoc / Vchasno handling as-is.

## Decisions

### D1: Dedicated `createManualAct` orchestrator, not `runClassification`

Add `lib/acts/create-manual-act.ts` exporting `createManualAct(input)` that runs in a single `dbPool.transaction`: insert the backing payment → `nextActNumber(tx, clientId, actDate)` → `buildActStub` from admin inputs (with `payment.id`) → set `fopSnapshot` from `getFopRequisites()` → insert act → update payment to `classified` + `act_id` → after commit, fire `generateAndStoreActPdf(actId)` (which auto-sends to DubiDoc). Rationale: `classify()` re-derives service/quantity/amount from the payment and tariffs — exactly what the admin wants to override. Threading overrides through the classifier would distort its contract; a parallel orchestrator that reuses the same building blocks is cleaner. Alternative (force values through `runClassification` with a `forced*` bag) rejected as leaky.

### D2: Backing payment shape

Insert a `payments` row with `source = 'manual_external'`, `bank_transaction_id = 'manual:{uuid}'`, `amount` = admin amount, `payment_date` = admin-supplied (or period-derived) date, `purpose` = a fixed manual-entry note, `payer_name` / `payer_legal_id` = from the selected client (NOT NULL columns), `bank_label` = optional admin input, `status` set to `classified` once the act exists. Rationale: satisfies all NOT NULL columns from real data; the `manual:` prefix guarantees the synthetic id never collides with a PrivatBank `REF+REFN` (which are bank reference strings), so the shared unique constraint holds and the poll's id space is disjoint.

### D3: Period decoupled via explicit month input

`act_date = lastDayOfMonth(chosen period month)`, independent of the payment date. Reuse the existing `lastDayOfMonth` helper from `act-stub.ts`. Rationale: covers "paid in January for December" and pre-launch backfill; the auto path's payment-date coupling is wrong for manual entry.

### D4: Tariff as an overridable hint, computed client-side then re-validated server-side

On client/service selection the form pre-fills unit price via `resolveAccessPrice` / `resolveSmsPrice` and a default quantity, but the admin can override both quantity and amount. The server re-validates the final numbers (Zod) and stores `amount` as entered (the act's authoritative sum, consistent with the annual-discount precedent where `amount ≠ unit_price × quantity`). Rationale: matches the existing `amount`-is-truth model in `acts.ts`.

### D5: Client picker restricted to clients with a contract

The contract is required for `contract_snapshot` / the PDF preamble (`договір №… від …`). The picker loads only clients that have a contract row. Rationale: the user chose "require existing contract" over inline contract entry; keeps this change focused.

### D6: UI reuses established patterns

A page under the acts area with a server-action submit (`createManualActAction`) returning the created act id for navigation to `/acts/{id}`. Tariff hint fetched via a small server action or passed with the client list. DESIGN.md tokens for form/badges. Rationale: consistent with existing act/queue server-action + `router.refresh()` flows.

## Risks / Trade-offs

- **Manual payment pollutes the payments list** → it is a legitimate prepayment record; filterable by `source`. Acceptable and intended (unified history).
- **Admin enters a period that already has an act** → numbering yields `MM/YYYY/N` via the existing `FOR UPDATE` path; duplicates are a domain decision left to the admin (same as the auto path).
- **A real PrivatBank payment later arrives for the same period** → it is a distinct payment with a real id and would classify into its own act; reconciliation/dedup of "same economic event across banks" is out of scope and noted for a future change.
- **NOT NULL payer fields for other-bank payers** → sourced from the selected client; acceptable since the act is issued to that client regardless of which bank received the money.
- **PDF/DubiDoc failure after act insert** → same semantics as the auto path: act remains `draft` with `pdf_file_url = NULL`, admin can regenerate/resend; the transaction that created payment+act is not rolled back by a later async PDF failure.

## Migration Plan

1. Confirm `add-privatbank-statement-by-date` is applied first (provides `source` / `bank_label`); no new migration here.
2. Ship `lib/acts/create-manual-act.ts`, the form schema, server action, client-with-contract loader, synthetic-id helper, page, and tests behind the new route.
3. Rollback: feature is additive (new route + new code path). Reverting code leaves no orphan schema; any manual payments/acts already created remain valid rows.

## Open Questions

- Payment date for a manual external payment when the admin only knows the period: default to the last day of the chosen month vs. an explicit date field. Leaning explicit-but-optional, defaulting to period end. Not blocking.
- Whether to surface a `source` filter chip on `/payments` in this change or defer to a small follow-up. Defer unless trivial.

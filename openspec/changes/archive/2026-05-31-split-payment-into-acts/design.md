## Context

Acts are produced today by automatic classification (`lib/classification/run-classification.ts`) or by manual creation (`lib/acts/create-manual-act.ts`). Both end at the same shape: an `acts` row backed by exactly one `payments` row (`acts.payment_id NOT NULL`), with the payment left `classified` + `act_id` set. D-007 froze this at 1:1 and pushed bundled payments to the queue.

The manual-act flow (`add-manual-act`) handles "money that never reached the app" by **minting a synthetic `manual_external` payment** per act. Operators have been (mis)using it to cover bundled real payments: they skip the real transfer and create one manual act per service, producing fabricated payments that double-count the money and detach the acts from the real transfer.

This change adds a **manual split**: attach several acts to one _existing_ real payment. The schema already permits it — `acts.payment_id` is `NOT NULL` but carries **no unique constraint**, so many acts may reference one payment. The reverse pointer `payments.act_id` (single, nullable, `ON DELETE SET NULL`) becomes a denormalised "primary act" hint; the authoritative linked-act set is `acts WHERE payment_id = …`.

Constraints unchanged: `lib/` pure; MSW for HTTP; real Neon test DB; dev/prod separate Neon branches; DESIGN.md tokens.

## Goals / Non-Goals

**Goals:**

- One payment → N acts in a single atomic operation, each act a full first-class act (number, snapshots, PDF, EDO) attached to the **existing** payment.
- Enforce `Σ(act.amount) == payment.amount` at split time.
- Reach the split from queued/received **and skipped** payments; never fabricate a payment.
- Reuse `buildActStub`, `nextActNumber`, FOP snapshot, PDF, EDO verbatim.
- Solve both the access+sms bundle and the two-OSBB transit bundle (D-027) with the same form.

**Non-Goals:**

- Automatic detection/splitting of bundles — classification still sends bundles to the queue (D-007's auto path is unchanged).
- Partial allocation / prepayment remainder (`Σ < payment.amount`) — v1 requires exact equality.
- Per-act edit of a split act, or splitting an already-`classified` payment without cancelling first.
- Reconciling "the same economic event across two banks" (a real second payment) — out of scope, as in `add-manual-act`.
- Any schema migration.

## Decisions

### D1: Dedicated `splitPayment` orchestrator, not `runClassification`

Add `lib/acts/split-payment.ts` exporting `splitPayment(paymentId, lines[])` running in one `dbPool.transaction`: load + lock the payment, validate `Σ(line.amount) == payment.amount`, then for each line `nextActNumber(tx, line.clientId, actDate)` → `buildActStub` (with the **existing** `payment.id`) → set `fopSnapshot` → insert act; finally update payment → `status = 'classified'`, `act_id = firstAct.id`. After commit, fire `generateAndStoreActPdf(actId)` per act (auto-sends to EDO). Rationale: same building blocks as `create-manual-act`, but it consumes an existing payment instead of inserting one, and loops over lines. `classify()` re-derives a single service/amount from the payment — the opposite of what split needs.

### D2: Reconciliation is strict equality, computed in decimal

`Σ(line.amount) == payment.amount`, compared as `numeric(10,2)` (string/decimal, not float) to avoid drift. Rejected over/under with a clear message. Rationale: strict `==` keeps the model honest (every hryvnia of the real transfer is accounted for by an act) and is the precise inverse of the double-counting bug. `≤` (remainder) is a separate future scenario (prepayment) and is a Non-Goal.

### D3: Cardinality Payment↔Act becomes 1:N — revises D-007

New ADR **D-042** `Переглядає: D-007`: D-007's 1:1 holds for **automatic** classification (bundled → queue, unchanged); a **manual** split makes Payment↔Act `1:N` under the `Σ == amount` invariant. project.md's «One payment ↔ one act … No bundling, no split» bullet is reworded to state the invariant. Rationale: the 1:1 rule was a simplification that the access+sms and two-OSBB realities outgrew; the queue-only answer forced the fabrication workaround.

### D4: No fabricated payments; `act_id` denormalised, acts read via reverse lookup

The split inserts **zero** payment rows. Each act's `payment_id` = the existing payment. `payments.act_id` is set to the first act purely as a denormalised pointer for legacy single-act displays; every surface that must show "the acts for this payment" queries `acts WHERE payment_id = …`. Rationale: avoids a destructive migration (no dropping `act_id`) while making the reverse lookup canonical. The payment detail and the classification payment-card switch to listing all linked acts.

### D5: Split available from `received` / `awaiting_review` / `in_queue` / `skipped`

Modify classification's "Skip is terminal": skip blocks _classification_, but a skipped payment MAY still be split. Rationale: bundled payments are exactly what operators skip today (incl. the live Великошпанівське 6460); forcing an un-skip step first is friction with no benefit. Splitting a skipped payment transitions it to `classified`.

### D6: Mutation model — cancel-and-re-split, no per-act edits

Split acts are backed by a non-`manual_external` payment, so the existing manual edit/delete paths (gated to `source = manual_external`) do not touch them by construction. The only mutation is **«Скасувати розділення»**: while _all_ sibling acts are `draft`, delete them all and return the payment to its pre-split status (`received` if it was received/queued; `skipped` if it came from skipped — recorded so cancel is reversible to the prior state). Blocked if any sibling is `sent_to_edo` / `signed` (an EDO document exists). Rationale: keeping `Σ == amount` under arbitrary per-act edits is complex; wholesale cancel keeps the invariant trivially true and matches the draft-only deletability already established for manual acts.

### D7: Per-line client picker = clients with a contract (NOT constrained to payer EDRPOU)

Each line picks a client from the searchable contract-only picker reused from `manual-acts`. Unlike manual same-EDRPOU reclassification (D-041), split is **not** constrained to the payer EDRPOU — the two-OSBB transit bundle (D-008/D-027) has a payer EDRPOU that is the transit account, not either client. Rationale: split is a deliberate manual judgement over an ambiguous payment; the contract requirement (for `contract_snapshot`/PDF) is the only hard filter.

### D8: Per-line period; act_date = last day of the line's month

Each line carries its own period month (default = the payment's month), `act_date = lastDayOfMonth(line month)`. Rationale: a bundle may legitimately mix periods (e.g. arrears + current); reuse the `lastDayOfMonth` helper, consistent with manual-acts D3.

## Risks / Trade-offs

- **Reconciliation rounding** → compare as `numeric(10,2)`/decimal, never float; unit-test boundary sums (e.g. 6460 = 1000 + 5460, and a 3-way split).
- **A real second bank payment for the same event** → distinct payment, classifies on its own; cross-bank dedup is out of scope (noted, as in `add-manual-act`).
- **Strict `==` rejects legitimate prepayment-with-remainder** → accepted for v1; remainder/partial allocation is a future change.
- **PDF/EDO failure after act insert** → same semantics as auto/manual paths: act stays `draft`, `pdf_file_url = NULL`, regenerate/resend later; the split transaction is not rolled back by a later async failure.
- **Cancel blocked once one sibling is in EDO** → intentional; an issued document can't be silently unwound. Operator handles the EDO side manually first.
- **`payments.act_id` ambiguity** (points only to the primary act) → mitigated by making `acts.payment_id` reverse lookup canonical everywhere that lists acts; `act_id` is display-only legacy.

## Migration Plan

- **No DB migration.** `acts.payment_id` (NOT NULL, non-unique) and `payments.act_id` (nullable) already support 1:N.
- **Docs:** add ADR D-042 (`Переглядає: D-007`), append to the ADR index; reword the project.md non-negotiable bullet; note in `docs/prd.md` / `prd-rationale.md` if FR IDs are tracked there.
- **Data backfill:** none automated. The existing Великошпанівське mess is cleaned manually post-ship (cancel the two workaround manual acts → split the real 6460).

## Open Questions

- Should a future iteration allow `Σ < payment.amount` (prepayment remainder) and keep the payment in a `partially_classified`-like state? Deferred.
- Should cancel-split that originated from `skipped` restore `skipped` or drop to `received`? Current decision: restore the **prior** status (skipped→skipped) so cancel is a true undo.

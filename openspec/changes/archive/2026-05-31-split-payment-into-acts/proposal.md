## Why

D-007 («один платіж = один акт, без агрегації») assumed every payment maps to exactly one act. Real life breaks that for **bundled payments** — one bank transfer that covers more than one act:

- a client pays **access + sms in a single transfer** (the Великошпанівське case: 6460 = access 1000 + sms 5460);
- a transit/aggregated transfer that pays for **two different OSBB** at once (D-027 explicitly names this as the case D-007 makes "принципово некласифіковним без розщеплення").

Today such a payment cannot be classified by amount, so it lands in the queue or is skipped. The only way to still produce the acts is the **manual-act workaround**, which mints a _fake_ `manual_external` payment per act — double-counting the real money (6460 real + 1000 + 5460 fake = 12920 in the payments list) and lying that the money "did not arrive via PrivatBank". The real transfer is left orphaned as `skipped`.

We need a first-class way to **split one real payment into several acts**, attaching the acts to the actual payment instead of fabricating new ones.

Key enabler already in the schema: `acts.payment_id` is `NOT NULL` but **not unique**, so many acts → one payment is already representable. The gap is tooling + a reconciliation rule + UI. **No DB migration is required.**

This **revises D-007**: automatic classification stays strictly 1:1 (bundled → queue, unchanged); a new _manual_ split path makes Payment↔Act `1:N` for explicitly-split payments, governed by `Σ(act.amount) == payment.amount`.

## What Changes

- New admin action on a payment detail page **«Розділити на акти»**: the operator adds N act lines (each: client with a contract, period month, service, quantity, amount — tariff-hinted like the manual-act form), and the system creates N acts **all linked to that one existing payment** in a single transaction.
- **Reconciliation invariant (v1 strict):** the sum of the line amounts MUST equal the payment amount; otherwise the split is rejected. A running «Розподілено X / Y · Залишок Z» indicator guides entry.
- The split **does not create any new payment**. Each act's `payment_id` points to the existing payment; the payment becomes `classified`; `payments.act_id` denormalises to the first/primary act, the full set is read back via `acts.payment_id`.
- **Split is available from `received` / `awaiting_review` / `in_queue` and from `skipped`** — split is the one action that reverses a skip, because skip was the previous workaround for exactly this case.
- **Cancel split** «Скасувати розділення»: while all sibling acts are still `draft`, deletes all of the split's acts and returns the payment to its pre-split status. Blocked once any sibling act is `sent_to_edo` / `signed`. Split acts are not edited/deleted individually (the manual edit/delete path stays gated to `source = manual_external`); to change a split, cancel and re-split.
- **Per-act reuse:** each line reuses the existing race-safe numbering (`SELECT … FOR UPDATE`), client/contract/FOP snapshots, PDF generation/Blob storage, and EDO send — identical to manual-act creation, just attached to a real payment.
- Payment detail shows **all** linked acts with the allocation summary (not a single act link).
- New **ADR D-042** «Розділення платежу на кілька актів (ручне)» with `Переглядає: D-007`; the project.md non-negotiable «One payment ↔ one act … No bundling, no split» is reworded to the `Σ(act.amount) == payment.amount` invariant.

## Capabilities

### New Capabilities

- `payment-split`: manual splitting of one real payment into several acts — the N-line split form, the `Σ(act.amount) == payment.amount` reconciliation, attaching every act to the existing payment (no fabricated payments), availability from skipped/queued/received states, the wholesale cancel-split, and reuse of the numbering/snapshot/PDF/EDO pipeline per act.

### Modified Capabilities

- `classification`: a `skipped` payment is no longer absolutely terminal — it MAY still be split into acts; the payment card gains a «Розділити на акти» action for unclassifiable/skipped payments, and a `classified` payment that backs several acts shows links to **all** of them.

## Impact

- **Revises:** D-007 (1 payment = 1 act). New ADR **D-042** (`Переглядає: D-007`); project.md «Non-negotiable constraints» bullet reworded.
- **DB:** **no migration.** `acts.payment_id` (NOT NULL, non-unique) already supports many-acts→one-payment; `payments.act_id` kept as a denormalised pointer to the primary act.
- **Code (new):** payment-split orchestrator `lib/acts/split-payment.ts` (one `dbPool.transaction`, N acts, reconciliation guard, payment → `classified`); cancel-split orchestrator; Zod schema for the N-line form; server actions `splitPaymentAction` / `cancelSplitAction`; «Розділити на акти» UI on `/payments/[id]`.
- **Code (reused):** `buildActStub` / `nextActNumber` / `getFopRequisites` / `getServiceNames` / `generateAndStoreActPdf` / EDO send; `resolveAccessPrice` / `resolveSmsPrice` for per-line hints; the clients-with-contract picker from `manual-acts`.
- **No external API calls** for the split itself; per-act EDO send reuses the existing integration.
- **Existing data cleanup (Великошпанівське):** after this ships, cancel/delete the two workaround manual acts (removes the fake `manual_external` payments) and split the real 6460 `skipped` payment into access 1000 + sms 5460.

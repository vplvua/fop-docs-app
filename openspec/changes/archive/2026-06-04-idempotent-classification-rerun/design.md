# Design — idempotent-classification-rerun

## Context

`runClassification` wraps the whole pipeline in a single Postgres transaction and takes `SELECT … FOR UPDATE` on the payment row (FR-CLASS-15) precisely so two concurrent runs cannot both create an act. The guard that enforces "already final" lives in `fetchClassificationData`:

```ts
if (payment.status === "classified" || payment.status === "skipped") {
  throw new Error(`Payment ${paymentId} is already ${payment.status}`);
}
```

`throw` was a reasonable default when the only caller was the cron poll (which awaits and discards the result). But two real callers now legitimately race the same payment:

```
Manual import (fire-and-forget)              Operator on /payments/[id]
─────────────────────────────────           ──────────────────────────────────
INSERT payment (received)
runClassification(id)  ── #1 (not awaited)
return → router.push('/payments/id')
                                             render: SELECT status → "received"
  #1: BEGIN; SELECT…FOR UPDATE               render: show «Класифікувати» button
  #1: classify → INSERT act 11/2025          click → classifyPaymentAction
  #1: UPDATE status=classified; COMMIT          guard: SELECT status → "received" ✓
                                                runClassification(id) ── #2
                                                  #2: BEGIN; SELECT…FOR UPDATE ⟵ blocks on #1
       (lock released by #1 COMMIT) ─────────────► #2: re-read status = "classified"
                                                  #2: throw "is already classified"  ✗ (red error)
```

`#1` produced the correct, single act. `#2` is redundant. The bug is that `#2` throws instead of recognising the work is done.

## Decision

Make the second writer a **no-op** rather than an error. Three layers:

### 1. Detect terminal state under the lock, return a sentinel (not `throw`)

Inside the locked transaction, after `SELECT … FOR UPDATE`, when `status ∈ {classified, skipped}`:

- do **not** call `classify()`,
- do **not** insert an act,
- do **not** write the payment row,
- return a no-op marker up the call chain.

`classifyPaymentInTx` short-circuits to `{ classResult: null, actId: null }`. The terminal-state check already runs _before_ `classify()` in `fetchClassificationData`, so no extra ordering work is needed — it simply returns instead of throwing.

### 2. `runClassification` returns `ClassificationResult | null`

```ts
export async function runClassification(
  paymentId: string,
  forcedClientId?: string,
): Promise<ClassificationResult | null> {   // null ⇒ payment was already terminal; no-op
  ...
  if (result === null) return null;          // no-op: skip PDF
  if (result.actId) generateAndStoreActPdf(result.actId).catch(() => {});
  return result.classResult;
}
```

`null` is safe because **no current caller inspects the return value** — `classifyPaymentAction`, `linkPaymentClientAction`, `importStatementTransactionAction`, and the cron poll all ignore it (the cron uses `Promise.allSettled`). A `catch`-less no-op means PDF is never regenerated for the already-existing act.

### 3. Action layer maps no-op → success

`classifyPaymentAction`:

```
pre-tx SELECT status
  status === "classified"            → return { ok: true }   // already done; UI refreshes to act
  status === "skipped"               → return { ok:false, … } // skip is terminal for classification (FR-CLASS-18)
  status ∈ RECLASSIFIABLE            → runClassification(id)
                                         returns null (raced to terminal) → { ok: true }
                                         returns result                   → { ok: true }
                                         throws (real error)              → { ok:false, error }
```

This covers **both** timing sub-cases of the same root race:

- the reported one (guard reads `received`, run #2 hits the in-tx no-op) → `null` → `ok:true`;
- the slightly-later one (guard reads `classified` because #1 already committed) → `ok:true` directly.

Either way the panel refreshes into `ClassifiedInfo` and shows the act — no red error. `linkPaymentClientAction` gets the same `null → { ok:true }` mapping.

## Alternatives considered

- **Option 1 — `await runClassification` in the import action before navigating.** Closes the specific import→navigate window (the page would render after the commit, so no button). Rejected as the _primary_ fix: it only addresses the import path, slows the import response by a full classification + settings load, and leaves `runClassification` still throwing for any _other_ concurrent trigger (e.g. cron poll overlapping a manual click, or future callers). Idempotency fixes the class of bug, not one window. (We keep import fire-and-forget for responsiveness; the brief redundant button is now harmless.)
- **Option 2 — swallow the "is already …" error string in `classifyPaymentAction`.** Works, but string-matching an internal `Error.message` is brittle and leaves the orchestrator itself a foot-gun for every other caller. Subsumed by doing the right thing one layer down.
- **Reconstruct a full `classified` `ClassificationResult` for the no-op** (rebuild `actStub` from the existing act). Pointless — no caller reads the value — and risky (the act stub is a snapshot that we'd have to re-derive). `null` is the honest "nothing happened here" signal.

## Risks

- **`linkPaymentClientAction` no-op when already classified to a _different_ client.** Returning `{ ok:true }` would silently accept an outcome that ignores the forced client. In practice the link action is offered only for `awaiting_review(multiple_clients_same_edrpou)`; a background run cannot auto-classify that state (it routes back to `awaiting_review`, never `classified`), so the link-vs-classify race to `classified` does not arise. The refresh shows the truth regardless. Acceptable; noted rather than guarded.
- **Skip-vs-classify race.** A payment could in theory flip to `skipped` between the classify guard and the lock, hitting the `skipped` no-op branch. The UI disables both buttons via a single `loading` state, and skip is a deliberate manual action, so this is defensive only. `classifyPaymentAction` keeps rejecting a pre-tx `skipped` status (FR-CLASS-18), and the in-tx `skipped` no-op returns `null` (treated as success) — neither creates an act.

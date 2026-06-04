## Why

The first cut of `payment-split` let every act line pick **any** contract-bearing client, deliberately unconstrained by the payer EDRPOU so a transit/aggregated transfer could be split across two different OSBB (D-027). In practice almost every split is a **single payer paying for several of their own services** (e.g. ОСББ "Саланг", ЄДРПОУ 26206408, paying 600.00 = access + sms). For that case the unconstrained picker is a foot-gun: the form defaults to `clients[0]` — an arbitrary unrelated client — and nothing stops the operator from attaching the acts to the wrong company.

The payment already carries an authoritative payer identity (`payments.payer_legal_id`). We should anchor the split on it, exactly as classification matching does (D-041, EDRPOU-first), and drop the per-line payer choice — there is no reason to let one payment's acts land on a different payer.

The transit/aggregated case (D-008/D-027) stays the **one exception**: when the payer EDRPOU is the intermediary bank's (configured `transit_edrpou_list`), it cannot identify the client, so the cross-client picker must remain.

## What Changes

- **Eligible clients are scoped to the payer EDRPOU.** The split page loads only contract-bearing clients whose `legal_id == payments.payer_legal_id`, instead of all contract clients.
- **The per-line client picker is removed for the common single-payer case.** When the payer EDRPOU maps to exactly one contract-bearing client, every line is fixed to it and the payer is shown read-only (a banner «Платник для всіх актів …»). The picker is kept only when the payer has **more than one** contract (scoped to those same-EDRPOU clients).
- **Server-side guard.** `splitPaymentAction` re-checks that every line's client `legal_id` equals the payment's payer EDRPOU, so a tampered submission cannot attach acts to an unrelated client.
- **Transit exception preserved.** When `payer_legal_id ∈ transit_edrpou_list`, the form keeps the full contract-only picker per line, allows lines targeting different clients, and the server guard is skipped — the previously-documented cross-client behavior, now gated to transit payers only.
- **Empty state** names the payer when a non-transit payer has no contract-bearing client.
- Payment summary on the split page gains the **Платник** line (name + ЄДРПОУ) and a transit marker.

## Capabilities

### Modified Capabilities

- `payment-split`: the per-line client is no longer free-choice. It is constrained to the payment's payer EDRPOU (fixed, picker hidden when single; scoped picker when the payer has several contracts), with a transit-EDRPOU exception that retains the cross-client picker. Reconciliation, payment-attachment, availability, cancel, numbering/PDF/EDO behavior are unchanged.

## Impact

- **Refines:** D-042 (manual split) — adds the payer-EDRPOU scoping rule and its transit exception; reuses D-041 (EDRPOU-first) and D-008/D-027 (transit payer). No new ADR; D-042 gets an amendment note.
- **DB:** no migration. Reads `payments.payer_legal_id` (already present) and `settings.transit_edrpou_list` (already present).
- **Code:**
  - `app/(dashboard)/payments/[id]/split/page.tsx` — load payer fields + transit list; `loadEligibleClients(payerLegalId | null)`; payer summary; transit-aware copy and empty state.
  - `app/(dashboard)/payments/[id]/split/split-form.tsx` — `payerName`/`payerLegalId`/`isTransit` props; read-only payer banner; per-line picker shown only when `isTransit || clients.length > 1`.
  - `app/(dashboard)/payments/[id]/split/actions.ts` — load transit list; payer-EDRPOU guard per line (skipped for transit).
- **No external API calls.** No change to the split orchestrator (`lib/acts/split-payment.ts`) or the Zod schema.

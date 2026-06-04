# Design — constrain-split-to-payer-edrpou

## Context

`payment-split` (D-042) created the N-line split form with an **unconstrained** contract-only client picker per line. That was justified by the transit/aggregated case (D-027): one transfer paying for two OSBB. But the dominant case is a single payer paying for several of their own services, where the free picker (a) defaults to an arbitrary `clients[0]` and (b) permits attaching acts to the wrong company. The payment already names its payer via `payments.payer_legal_id`.

## Decision

Anchor the split on the payer EDRPOU, mirroring classification matching (D-041, EDRPOU-first), with the transit payer (D-008/D-027) as the sole exception.

### Eligibility resolution (page, server component)

```
transitList = getTransitEdrpouList()
isTransit   = transitList.includes(payment.payerLegalId)
clients     = loadEligibleClients(isTransit ? null : payment.payerLegalId)
              // null  → all contract-bearing clients (transit)
              // value → contract-bearing clients WHERE clients.legal_id = value
```

`loadEligibleClients` is the old `loadContractClients` with an optional `where(eq(clients.legalId, payerLegalId))`; passing `null` skips the filter (Drizzle treats `where(undefined)` as no predicate). This keeps a single loader for both branches.

### Picker visibility (client component)

```
showClientPicker = isTransit || clients.length > 1
```

- **Normal payer, 1 client** → no picker; all lines fixed to that client; read-only payer banner.
- **Normal payer, >1 contract for the same EDRPOU** → picker retained, scoped to those same-EDRPOU clients (operator chooses the contract, never the payer).
- **Transit payer** → picker retained over the full contract-only list; lines may target different clients.

### Server guard (defense in depth)

`splitPaymentAction` already loads the payment; it now also reads `payer_legal_id` and the transit list. For each line, when `!isTransit && client.legalId !== payment.payerLegalId` the split is rejected with no acts created. The form already enforces this, but the action is the trust boundary.

## Alternatives considered

- **Remove cross-client splitting entirely.** Simplest, matches the literal request, but regresses the transit/aggregated case (D-027) the feature was built for — a transit bundle would hit the empty state and become unsplittable. Rejected.
- **Add a top-level single client selector for the whole split** instead of per-line. Doesn't cover the same-EDRPOU multi-contract case where different lines map to different contracts; more UI for no gain. Rejected in favor of per-line picker only when there is a genuine choice.
- **Match by contract number from the purpose** (like classification's discriminator). Out of scope: the split is a manual operator action; scoping to the payer EDRPOU is enough to prevent the wrong-payer mistake, and the operator picks the contract when several share the EDRPOU.

## Risks

- A non-transit payer whose EDRPOU has **no contract-bearing client** now shows an empty state instead of a (wrong) default client. This is correct — an act needs the payer's contract snapshot — but means such payments cannot be split until the client/contract exists. Surfaced via the named empty-state message.
- If a transit payer is **not** configured in `transit_edrpou_list`, its split will be wrongly constrained to the bank's EDRPOU (empty state). Mitigation: the transit list is the existing, operator-managed source of truth already used by classification; no new config surface.

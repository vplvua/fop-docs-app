## Context

DubiDoc is the EDO provider for acts (`edo_provider = dubidoc`). Send uploads the act (`POST /documents`, owner = our org `docs@moeosbb.com`, one client participant, `workflowType: sequential`). In-app signing uses a hosted public sign page (`POST /documents/{id}/links` in an iframe); `finalizeInAppSigningAction` calls `POST /send` to forward to the client. Poll/refresh map the document-level `state` to act status.

**Defect:** the mapper treats `state === "signed"` as the only path to `signed`, but DubiDoc leaves `state = "sent"` even after every party has signed. Verified on two live docs:

- `10cdf21d-…` (2026-06-05): owner + the single client participant both `signed`, both signatures present, yet `state: "sent"`.
- `bb0cb857-…` (2026-06-06): same — `currentUser.status: "signed"`, client participant `signed`, both signatures present, `state: "sent"`.

**Root cause of the stuck `state`:** the FOP and the owner org are the **same DubiDoc account** (registered under EDRPOU/РНОКПП `2870111294`). DubiDoc's `state` rollup never emits `signed` for this org-as-owner + external-client configuration.

## Goals / Non-Goals

**Goals:**

- Status sync reaches `signed` for every signing path (in-app, directly in DubiDoc, client in their own DubiDoc) by reading per-node statuses instead of the unreliable `state`.
- Already-stuck acts self-heal on the next poll, no DB migration.
- No regression to send/sign/upload behavior.

**Non-Goals:**

- No change to document creation, the signing flow, `/send` semantics, retry/idempotency, amount-in-kopiykas, or the `vchasno_external` path.
- No self-hosted signing widget; no webhook adoption.

## Decisions

### D1 — Read-fix: derive "signed" from `currentUser` + participants

The shared mapper (`mapDubidocStatus(detail, participantsFetcher)`) decides:

1. `archived` → `deleted`; `refused` → `refused` (overrides).
2. `state === "signed"` fast-path → `signed` (no fetch).
3. FOP not signed (`currentUser.status !== "signed"`) → `sent_to_edo` (no fetch).
4. FOP signed → fetch participants: any `rejected` → `refused`; all `isSignatureRequired` signed → `signed`; else `waiting_for_client_sign`.

`currentUser` is the authenticated org (the FOP/owner), so `currentUser.status` is the FOP's signing state; the participants list carries the client's. These are ground truth; `state` is a lossy rollup that stalls. The participants fetch is gated to FOP-signed acts (step 4) and runs under the existing `POLL_CONCURRENCY = 4` throttle; `state === "signed"` short-circuits finalized docs. Applied identically by the poll cron and the manual refresh. A `state`-based fallback covers responses without `currentUser` (older/mocks).

### D2 — Rejected alternative: in-app owner `/sign` rework

Considered replacing the hosted public-link signing with a self-hosted IIT/Дія widget + `POST /sign` so the owner-first route advances and `state` finalizes. **Rejected:** a live re-test showed the hosted page already handles hardware-token (PKCS#11) КЕП signing well; re-implementing in-browser crypto is a large, risky lift that duplicates a working UI — and the read-fix (D1) already makes the app correct.

### D3 — Rejected alternative (spiked): FOP-as-participant restructure (“Option B”)

Considered creating the document with `ownerSignatureRequired: false` and the FOP as route participant 1 (client as participant 2) so a participant-first route could finalize `state`. **Spiked on doc `bb0cb857-…` and rejected:** because the FOP IS the owner account (EDRPOU `2870111294`), the FOP signature was applied to the owner relationship (`currentUser.status: signed`) while the separate FOP-participant node stayed `pending` forever — a phantom deadlock node. `state` stayed `sent` AND an extra never-satisfiable node was added. This proved `state` cannot be made to finalize for this account; D1 is the only practical fix.

## Risks / Trade-offs

- **[`state` remains cosmetically `sent` in DubiDoc’s own UI]** → acceptable: the PDF is legally signed and the app shows the correct status via D1. Documented for the user.
- **[Extra `/participants` call per FOP-signed act]** → bounded to pending acts past the FOP signature, under the existing throttle; `state === "signed"` fast-path avoids it for finalized docs.
- **[Mapper now needs two inputs]** → single shared `(detail, participantsFetcher)` signature keeps cron and manual refresh identical (no divergence).
- **[Option-B test doc `bb0cb857-…` is permanently stuck]** (phantom node) → a throwaway dev doc; ignore/cancel it. New acts use the unchanged single-participant structure and heal normally.

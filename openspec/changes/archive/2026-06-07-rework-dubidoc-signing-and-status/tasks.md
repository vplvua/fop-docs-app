## 1. Read-fix: per-node status detection

- [x] 1.1 Extend `lib/external-apis/dubidoc/types.ts`: add `currentUser { role, status }` to `DocumentStatusResponse`; add `DocumentParticipant` + `ParticipantStatus`.
- [x] 1.2 Add `getDocumentParticipants(docId)` to the client (`GET /documents/{id}/participants`) and export it.
- [x] 1.3 Rewrite `mapDubidocStatus` to be `currentUser` + participants based: archived→deleted, refused/participant-rejected→refused, `state==="signed"` fast-path→signed, FOP-not-signed→sent_to_edo (no fetch), FOP-signed→fetch participants→all required signed→signed else waiting_for_client_sign. `state` fallback when `currentUser` absent.
- [x] 1.4 Wire the participants-fetcher into `poll-dubidoc.ts` (`applyStatusUpdate`) and `refreshDubidocStatusAction`; preserve `POLL_CONCURRENCY = 4`.
- [x] 1.5 Update MSW handlers to the real detail shape (incl. `currentUser`) + serve `GET /documents/:id/participants`.
- [x] 1.6 Unit tests for every mapper branch (stuck-state→signed, fast-path, FOP-signed-client-pending, FOP-unsigned, archived, refused, participant-rejected, fallback); poll test for the stuck-state→signed case.

## 2. Reverted experiments (kept for the record)

- [x] 2.1 Spiked the FOP-as-participant restructure (“Option B”) on doc `bb0cb857-…` → produced a phantom never-signed FOP node; `state` still stuck. Reverted all create/send/finalize changes back to the original single-participant flow. (See design.md D3.)

## 3. QA + verification

- [x] 3.1 Run `npm run qa` green (lint → format:check → typecheck → test:run → build → openspec validate).
- [x] 3.2 Verified backfill on the real stuck act `10cdf21d-…`: ran the actual `mapDubidocStatus` against the live document — DubiDoc `state: "sent"`, `currentUser.status: "signed"`, all required participants `signed` → **read-fix verdict `act.status = signed`**. (The Option-B test doc `bb0cb857-…` stays stuck by design — ignored.)
- [x] 3.3 Updated memory `[[dubidoc-status-and-send-semantics]]` (state unreliable; read per-node; Option B rejected). Removed `.env.dubidoc-check` (secret) and the throwaway investigation scripts.

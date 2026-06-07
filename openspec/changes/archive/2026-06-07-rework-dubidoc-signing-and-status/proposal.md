## Why

Acts signed in DubiDoc never advance to «Підписано» in the app: they stay stuck on `waiting_for_client_sign` forever. Verified on live docs `10cdf21d-…` (2026-06-05) and `bb0cb857-…` (2026-06-06) — DubiDoc's document-level `state` stays `"sent"` even though the FOP and the client have both signed (per-node statuses `signed`, both signatures on the PDF). Our status mapper trusts `state === "signed"` as the only path to `signed`, so it can never reconcile.

A spike confirmed the `state` field is **inherently unreliable for this account setup** (the FOP and the owner org are the same DubiDoc account, EDRPOU `2870111294`): no document structure makes `state` finalize. So the fix reads the authoritative per-node statuses instead of `state`.

## What Changes

- **Status detection reads per-node statuses, not `state`.** An act is `signed` when the FOP has signed (`currentUser.status === "signed"`) **and** every required (`isSignatureRequired`) participant from `GET /documents/{id}/participants` has `status === "signed"`. `state === "signed"` is kept as a fast-path; `archived` → deleted and `refused`/participant-`rejected` → refused remain overrides; FOP-not-signed → `sent_to_edo` (no participants fetch). Fixes detection for **all** signing paths — in-app, directly in DubiDoc, and the client signing in their own DubiDoc — and heals already-stuck acts on the next poll.
- Real `currentUser` + participant response shapes are modeled in the DubiDoc API types; a `getDocumentParticipants` client call is added; MSW mocks updated.
- **No change** to document creation, the signing flow, or `/send` semantics — the existing send/sign behavior is kept (a `/sign`-rework and a participant-restructure were both spiked and rejected; see design.md).
- **Backfill:** already-stuck acts self-heal on the next poll — no DB migration.

## Capabilities

### New Capabilities

<!-- none — the send/sign/poll behavior already lives in edo-dubidoc -->

### Modified Capabilities

- `edo-dubidoc`: only **"DubiDoc status mapping"** changes — from "document-level `state` is the authoritative signal" to "FOP (`currentUser`) + required-participant per-node statuses are authoritative; `state === "signed"` is a fast-path." All other requirements (participants inline, auto-send, in-app signing, upload) are unchanged.

## Impact

- **Behavior:** stuck `waiting_for_client_sign` acts correctly become `signed` after the next poll / manual refresh.
- **Code:** `lib/edo/dubidoc-status.ts` (mapper), `lib/edo/poll-dubidoc.ts`, `app/(dashboard)/acts/[id]/act-actions.ts` (`refreshDubidocStatusAction`), `lib/external-apis/dubidoc/{types.ts,client.ts,index.ts}`, `tests/mocks/handlers/dubidoc.ts`.
- **External API:** adds `GET /documents/{id}/participants` reads to status sync (bounded to FOP-signed acts, under the existing throttle). No other DubiDoc call changes.
- **Reference:** `docs/api-docs/dubidoc.json` (OpenAPI), `scripts/inspect-dubidoc-doc.mjs` (read-only inspector).

import type { DocumentParticipant, DocumentStatusResponse } from "@/lib/external-apis/dubidoc";

/**
 * Patch derived from a DubiDoc status response. `status` is set only when the
 * act lifecycle advances; it is omitted when the lifecycle stays put (refused,
 * or an unknown intermediate status) so the caller leaves `acts.status` alone.
 */
export interface DubidocStatusPatch {
  status?: "sent_to_edo" | "waiting_for_client_sign" | "signed" | "deleted";
  edoStatus: string;
}

/** Lazily fetch the document's route participants (only when the FOP has signed). */
export type ParticipantsFetcher = () => Promise<DocumentParticipant[]>;

/**
 * Single source of truth for mapping a DubiDoc document to an act-status patch,
 * shared by the polling cron and the manual refresh action.
 *
 * The document-level **`state`** is NOT reliable as the "fully signed" signal:
 * DubiDoc leaves it at `sent` even after the FOP (owner) AND the client have
 * signed (verified 2026-06-05/06 on docs `10cdf21d-…` and `bb0cb857-…`). So we
 * read the authoritative per-node statuses instead:
 *
 * - the **FOP** (owner) via the detail's `currentUser.status`;
 * - the **client** via `GET /documents/{id}/participants`.
 *
 * Order of evaluation:
 * 1. `status === "cancelled"` → `deleted` (the document was анульовано in DubiDoc);
 *    `refused` → `refused` (overrides).
 * 2. `state === "signed"` fast-path → `signed` (no participants fetch).
 * 3. FOP not signed (`currentUser.status !== "signed"`) → `sent_to_edo` (no fetch).
 * 4. FOP signed → fetch participants: any `rejected` → `refused`; all required
 *    signed → `signed`; otherwise `waiting_for_client_sign`.
 *
 * `participantsFetcher` is invoked ONLY in step 4 so the extra call is bounded
 * to acts already past the FOP's signature.
 *
 * `archived === true` is NOT a removal: it is a normal (typically signed)
 * document filed into an archive folder, so it is left to derive its status via
 * the signature branches below (→ `signed`) and the payment is never freed.
 *
 * When `currentUser` is absent (older responses / mocks) it falls back to the
 * document-level `state`, then the org-relative `status`.
 */
export async function mapDubidocStatus(
  detail: DocumentStatusResponse,
  participantsFetcher: ParticipantsFetcher,
): Promise<DubidocStatusPatch> {
  // The document was cancelled (анульовано) in DubiDoc — the act's live copy is
  // gone. One `deleted` state covers both cancellation and 404-deletion; the
  // payment stays attached so the act can be re-sent (see send-to-dubidoc).
  if (detail.status === "cancelled") {
    return { status: "deleted", edoStatus: "cancelled" };
  }
  if (detail.refused) {
    return { edoStatus: "refused" };
  }
  // Fast-path: DubiDoc occasionally does reach `signed`; trust it directly.
  if (detail.state === "signed") {
    return { status: "signed", edoStatus: "signed" };
  }

  const ownerStatus = detail.currentUser?.status;

  // Fallback when the owner relationship is not reported (legacy/mocks).
  if (!ownerStatus) {
    return mapFromStateFallback(detail);
  }

  // FOP (owner) has not signed yet → still awaiting the FOP.
  if (ownerStatus !== "signed") {
    return { status: "sent_to_edo", edoStatus: detail.status || "new" };
  }

  // FOP signed → the client's signature decides "fully signed".
  const participants = await participantsFetcher();
  if (participants.some((p) => p.status === "rejected")) {
    return { edoStatus: "refused" };
  }
  const required = participants.filter((p) => p.isSignatureRequired);
  if (required.length > 0 && required.every((p) => p.status === "signed")) {
    return { status: "signed", edoStatus: "signed" };
  }
  return { status: "waiting_for_client_sign", edoStatus: detail.status || "sent" };
}

/**
 * No `currentUser` → infer from the document-level `state`, then the org-relative
 * `status`. Kept for older responses and tests that predate `currentUser`.
 */
function mapFromStateFallback(detail: DocumentStatusResponse): DubidocStatusPatch {
  if (detail.state === "sent") {
    return { status: "waiting_for_client_sign", edoStatus: "sent" };
  }
  if (detail.state === "new") {
    if (detail.status === "signed" || detail.status === "waiting_for_contractor_sign") {
      return { status: "waiting_for_client_sign", edoStatus: detail.status };
    }
    return { status: "sent_to_edo", edoStatus: "new" };
  }
  // No `state` either: last-resort org-relative `status` mapping.
  if (detail.status === "signed") {
    return { status: "signed", edoStatus: "signed" };
  }
  if (detail.status === "new") {
    return { status: "sent_to_edo", edoStatus: "new" };
  }
  if (detail.status === "waiting_for_contractor_sign") {
    return { status: "waiting_for_client_sign", edoStatus: "waiting_for_contractor_sign" };
  }
  return { edoStatus: detail.status };
}

import type { DocumentStatusResponse } from "@/lib/external-apis/dubidoc";

/**
 * Patch derived from a DubiDoc status response. `status` is set only when the
 * act lifecycle advances; it is omitted when the lifecycle stays put (refused,
 * or an unknown intermediate status) so the caller leaves `acts.status` alone.
 */
export interface DubidocStatusPatch {
  status?: "sent_to_edo" | "waiting_for_client_sign" | "signed" | "deleted";
  edoStatus: string;
}

/**
 * Single source of truth for mapping a DubiDoc `GET /documents/{id}` response to
 * an act-status patch, shared by the polling cron and the manual refresh action.
 *
 * The authoritative signal is the document-level **`state`** (`new → sent →
 * signed`), NOT the top-level `status`: `status` is computed relative to the
 * authenticated org (the FOP), so once the FOP signs it reads `signed` even
 * though the client has not — that's exactly the bug where a half-signed act
 * showed as «Підписано». `status` is only consulted to tell, while `state` is
 * still `new`, whether the FOP has already placed their own signature.
 *
 * - `state = signed` — all parties signed → `signed`.
 * - `state = sent` — forwarded down the route, awaiting the client → `waiting_for_client_sign`.
 * - `state = new` + org `status` signed/`waiting_for_contractor_sign` — FOP
 *   signed but the flow has not advanced yet → `waiting_for_client_sign`.
 * - `state = new` + org `status = new` — awaiting the FOP → `sent_to_edo`.
 *
 * `archived`/`refused` flags take precedence (after a completed signature); any
 * unknown value is recorded raw in `edo_status` without moving the lifecycle.
 *
 * When `state` is absent (older responses / mocks) it falls back to the legacy
 * org-relative `status` mapping.
 */
export function mapDubidocStatus(response: DocumentStatusResponse): DubidocStatusPatch {
  // Authoritative path: document-level `state` is present.
  if (response.state) {
    if (response.state === "signed") {
      return { status: "signed", edoStatus: "signed" };
    }
    if (response.archived) {
      return { status: "deleted", edoStatus: "archived" };
    }
    if (response.refused) {
      return { edoStatus: "refused" };
    }
    if (response.state === "sent") {
      return { status: "waiting_for_client_sign", edoStatus: "sent" };
    }
    // state === "new": disambiguate via the org-relative status whether the FOP
    // has already signed (so the flow only needs to advance to the client).
    if (response.status === "signed" || response.status === "waiting_for_contractor_sign") {
      return { status: "waiting_for_client_sign", edoStatus: response.status };
    }
    return { status: "sent_to_edo", edoStatus: "new" };
  }

  // Legacy fallback: no document-level `state` (older responses / mocks).
  if (response.status === "signed") {
    return { status: "signed", edoStatus: "signed" };
  }
  if (response.archived) {
    return { status: "deleted", edoStatus: "archived" };
  }
  if (response.refused) {
    return { edoStatus: "refused" };
  }
  if (response.status === "new") {
    return { status: "sent_to_edo", edoStatus: "new" };
  }
  if (response.status === "waiting_for_contractor_sign") {
    return { status: "waiting_for_client_sign", edoStatus: "waiting_for_contractor_sign" };
  }
  return { edoStatus: response.status };
}

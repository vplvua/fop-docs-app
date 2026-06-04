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
 * Known raw vocabulary (`new` → `waiting_for_contractor_sign` → `signed`):
 * - `new` — sent, awaiting the FOP's own signature → stays `sent_to_edo`.
 * - `waiting_for_contractor_sign` — FOP signed, the client (counterparty) has
 *   not → `waiting_for_client_sign`. (DubiDoc «contractor» = наш клієнт.)
 * - `signed` — both parties signed → `signed`.
 *
 * `archived`/`refused` flags take precedence; any unknown status is recorded raw
 * in `edo_status` without moving the lifecycle (safe degrade).
 */
export function mapDubidocStatus(response: DocumentStatusResponse): DubidocStatusPatch {
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

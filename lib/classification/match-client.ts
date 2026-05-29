import type { Client } from "@/lib/db/schema/clients";
import type { Contract } from "@/lib/db/schema/contracts";

import { CLASSIFICATION_REASONS } from "./types";

type ClientWithContract = Client & { contract: Contract | null };

type MatchResult =
  | { status: "matched"; client: ClientWithContract }
  | {
      status: "awaiting_review";
      reason: string;
      clientId: string | null;
      candidateClientIds: string[];
    }
  | { status: "in_queue"; reason: string };

function isActive(c: ClientWithContract): boolean {
  return !c.autoActDisabled;
}

function multipleContractsReason(parsedContractNumbers: string[]): string {
  return `${CLASSIFICATION_REASONS.multiple_contracts}:${parsedContractNumbers.join(",")}`;
}

/**
 * Pick a single client out of several that share an EDRPOU, using the contract
 * number as a secondary discriminator. Returns `matched` when exactly one
 * candidate is identified, otherwise routes to manual review.
 */
function discriminateByContract(
  candidates: ClientWithContract[],
  parsedContractNumbers: string[],
): MatchResult {
  // Contract is the discriminator here — more than one distinct number is
  // genuinely ambiguous (D-027), so we cannot auto-pick.
  if (parsedContractNumbers.length > 1) {
    return { status: "in_queue", reason: multipleContractsReason(parsedContractNumbers) };
  }

  const byContract = candidates.filter(
    (c) => c.contract !== null && parsedContractNumbers.includes(c.contract.number),
  );
  if (byContract.length === 1) {
    return { status: "matched", client: byContract[0]! };
  }

  return {
    status: "awaiting_review",
    reason: CLASSIFICATION_REASONS.multiple_clients_same_edrpou,
    clientId: null,
    candidateClientIds: candidates.map((c) => c.id),
  };
}

/**
 * EDRPOU-first client matching (revises D-009).
 *
 * The payer EDRPOU is the authoritative company identifier; the contract
 * number only discriminates between clients that share that EDRPOU and never
 * reassigns a payment across companies. Archived clients (`auto_act_disabled`)
 * are excluded from the active candidate set — they neither win matching over
 * an active sibling nor appear in the manual selector.
 */
export function matchClient(
  parsedContractNumbers: string[],
  payerLegalId: string,
  clients: ClientWithContract[],
  transitEdrpouList: string[],
): MatchResult {
  const isTransit = transitEdrpouList.includes(payerLegalId);

  // Transit payer (D-008): payer EDRPOU belongs to the intermediary bank, so
  // it cannot identify the client — match by contract among active clients.
  if (isTransit) {
    const activeByContract = clients.filter(
      (c) =>
        isActive(c) && c.contract !== null && parsedContractNumbers.includes(c.contract.number),
    );
    if (parsedContractNumbers.length > 1 && activeByContract.length !== 1) {
      return { status: "in_queue", reason: multipleContractsReason(parsedContractNumbers) };
    }
    if (activeByContract.length === 1) {
      return { status: "matched", client: activeByContract[0]! };
    }
    if (activeByContract.length > 1) {
      return {
        status: "awaiting_review",
        reason: CLASSIFICATION_REASONS.multiple_clients_same_edrpou,
        clientId: null,
        candidateClientIds: activeByContract.map((c) => c.id),
      };
    }
    // No active client by contract — fall back to an archived one (exclusion
    // list reached via transit), else nothing matched.
    const archivedByContract = clients.filter(
      (c) =>
        !isActive(c) && c.contract !== null && parsedContractNumbers.includes(c.contract.number),
    );
    if (archivedByContract.length >= 1) {
      return { status: "matched", client: archivedByContract[0]! };
    }
    return { status: "in_queue", reason: CLASSIFICATION_REASONS.no_match };
  }

  // Normal path — anchor on the payer EDRPOU.
  const candidates = clients.filter((c) => c.legalId === payerLegalId);
  if (candidates.length === 0) {
    return { status: "in_queue", reason: CLASSIFICATION_REASONS.no_match };
  }

  const activeCandidates = candidates.filter(isActive);

  if (activeCandidates.length === 1) {
    return { status: "matched", client: activeCandidates[0]! };
  }

  if (activeCandidates.length > 1) {
    return discriminateByContract(activeCandidates, parsedContractNumbers);
  }

  // Only archived clients share this EDRPOU (e.g. exclusion-list client, or
  // junk duplicates with no active sibling). Single → matched (classify routes
  // it to auto_act_disabled). Several → cannot auto-pick; needs un-archiving.
  if (candidates.length === 1) {
    return { status: "matched", client: candidates[0]! };
  }
  return {
    status: "awaiting_review",
    reason: CLASSIFICATION_REASONS.auto_act_disabled,
    clientId: null,
    candidateClientIds: [],
  };
}

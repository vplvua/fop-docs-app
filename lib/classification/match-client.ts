import type { Client } from "@/lib/db/schema/clients";
import type { Contract } from "@/lib/db/schema/contracts";

import { CLASSIFICATION_REASONS } from "./types";

type ClientWithContract = Client & { contract: Contract | null };

type MatchResult =
  | { status: "matched"; client: ClientWithContract }
  | { status: "in_queue"; reason: string };

export function matchClient(
  parsedContractNumbers: string[],
  payerLegalId: string,
  clients: ClientWithContract[],
  transitEdrpouList: string[],
): MatchResult {
  const isTransit = transitEdrpouList.includes(payerLegalId);

  if (parsedContractNumbers.length > 0) {
    const byContract = clients.filter(
      (c) => c.contract !== null && parsedContractNumbers.includes(c.contract.number),
    );

    if (byContract.length > 0) {
      if (isTransit) {
        return { status: "matched", client: byContract[0]! };
      }

      const exact = byContract.filter((c) => c.legalId === payerLegalId);
      if (exact.length > 0) {
        return { status: "matched", client: exact[0]! };
      }

      return {
        status: "in_queue",
        reason: CLASSIFICATION_REASONS.ambiguous_client,
      };
    }
  }

  const byLegalId = clients.filter((c) => c.legalId === payerLegalId);
  if (byLegalId.length > 0) {
    return { status: "matched", client: byLegalId[0]! };
  }

  return { status: "in_queue", reason: CLASSIFICATION_REASONS.no_match };
}

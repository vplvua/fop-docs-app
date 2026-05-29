"use server";

import { eq, ilike, or } from "drizzle-orm";

import { db } from "@/lib/db";
import { clients } from "@/lib/db/schema/clients";
import { contracts } from "@/lib/db/schema/contracts";

import type { ClientCandidate } from "@/app/(dashboard)/payments/[id]/classification-panel";

/**
 * Read-only client search for the `no_match` queue card. Matches active and
 * archived clients by name or EDRPOU; linking is still gated by
 * `linkPaymentClientAction`'s same-EDRPOU/contract guardrail, so a broad match
 * here cannot bypass the rule.
 */
export async function searchClientsAction(query: string): Promise<ClientCandidate[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const pattern = `%${trimmed}%`;
  const rows = await db
    .select({
      id: clients.id,
      name: clients.name,
      moeosbbUserId: clients.moeosbbUserId,
      contractNumber: contracts.number,
    })
    .from(clients)
    .leftJoin(contracts, eq(contracts.clientId, clients.id))
    .where(or(ilike(clients.name, pattern), ilike(clients.legalId, pattern)))
    .limit(10);

  return rows;
}

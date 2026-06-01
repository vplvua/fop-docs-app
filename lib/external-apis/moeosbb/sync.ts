import { and, eq, isNotNull, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { clients } from "@/lib/db/schema/clients";
import { contracts } from "@/lib/db/schema/contracts";
import { logger } from "@/lib/logging";
import { recordIntegrationError, recordIntegrationSuccess } from "@/lib/observability";

import { fetchMoeosbbClients } from "./client";
import { mapRemoteContractDate, mapRemoteToClientFields } from "./mapper";
import type { MoeosbbRemoteClient } from "./types";

export interface SyncResult {
  fetched: number;
  matched: number;
  updated: number;
  created: number;
  /** Contract rows whose signed_date was updated from osbb_users.createdt. */
  contractsUpdated: number;
}

type ClientFields = ReturnType<typeof mapRemoteToClientFields>;

interface ClientUpdate {
  localId: string;
  fields: ClientFields;
  /** Normalized osbb_users.createdt, or null when missing/unparseable. */
  contractDate: string | null;
}

interface ClientInsert {
  moeosbbUserId: number;
  fields: ClientFields;
}

function planSync(
  remoteClients: MoeosbbRemoteClient[],
  localByMoeosbbId: Map<number, string>,
  singleMoeosbbId?: number,
): { updates: ClientUpdate[]; inserts: ClientInsert[] } {
  const updates: ClientUpdate[] = [];
  const inserts: ClientInsert[] = [];

  for (const remote of remoteClients) {
    const remoteId = Number(remote.id);
    if (singleMoeosbbId !== undefined && remoteId !== singleMoeosbbId) continue;

    const localId = localByMoeosbbId.get(remoteId);
    if (localId) {
      updates.push({
        localId,
        fields: mapRemoteToClientFields(remote),
        contractDate: mapRemoteContractDate(remote),
      });
    } else if (singleMoeosbbId === undefined) {
      inserts.push({ moeosbbUserId: remoteId, fields: mapRemoteToClientFields(remote) });
    }
  }

  return { updates, inserts };
}

function countFulfilled(results: PromiseSettledResult<unknown>[]): number {
  return results.filter((r) => r.status === "fulfilled").length;
}

async function applySync(
  updates: ClientUpdate[],
  inserts: ClientInsert[],
): Promise<{ updated: number; created: number; contractsUpdated: number }> {
  const updateResults = await Promise.allSettled(
    updates.map(({ localId, fields }) =>
      db
        .update(clients)
        .set({ ...fields, lastSyncAt: sql`now()`, updatedAt: sql`now()` })
        .where(eq(clients.id, localId)),
    ),
  );

  const insertResults = await Promise.allSettled(
    inserts.map(({ moeosbbUserId, fields }) =>
      db.insert(clients).values({ ...fields, moeosbbUserId, lastSyncAt: sql`now()` }),
    ),
  );

  // Update the contract date (contracts.signed_date) for matched clients that
  // both carry a parseable createdt and already have a contract row. New clients
  // get no contract here — the contract number is required and not in MoeOSBB.
  const contractUpdates = updates.filter((u) => u.contractDate !== null);
  const contractResults = await Promise.allSettled(
    contractUpdates.map(({ localId, contractDate }) =>
      db
        .update(contracts)
        .set({ signedDate: contractDate as string, updatedAt: sql`now()` })
        .where(eq(contracts.clientId, localId)),
    ),
  );

  return {
    updated: countFulfilled(updateResults),
    created: countFulfilled(insertResults),
    contractsUpdated: countFulfilled(contractResults),
  };
}

export async function runMoeosbbSync(singleMoeosbbId?: number): Promise<SyncResult> {
  try {
    const remoteClients = await fetchMoeosbbClients();

    const localClients = await db
      .select({ id: clients.id, moeosbbUserId: clients.moeosbbUserId })
      .from(clients)
      .where(and(isNotNull(clients.moeosbbUserId), eq(clients.autoActDisabled, false)));

    const localByMoeosbbId = new Map(localClients.map((c) => [c.moeosbbUserId!, c.id]));

    const { updates, inserts } = planSync(remoteClients, localByMoeosbbId, singleMoeosbbId);
    const { updated, created, contractsUpdated } = await applySync(updates, inserts);

    const matched = updates.length;
    const fetched = remoteClients.length;

    await recordIntegrationSuccess("moeosbb");
    logger.info(
      { event: "moeosbb.sync_complete", fetched, matched, updated, created, contractsUpdated },
      "moeosbb sync complete",
    );

    return { fetched, matched, updated, created, contractsUpdated };
  } catch (err) {
    await recordIntegrationError("moeosbb", err);
    throw err;
  }
}

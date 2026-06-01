import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";

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
  /** Existing contract rows whose signed_date was updated from osbb_users.createdt. */
  contractsUpdated: number;
  /** Contract rows created for matched clients that had none (number = moeosbb_user_id). */
  contractsCreated: number;
}

type ClientFields = ReturnType<typeof mapRemoteToClientFields>;

interface ClientUpdate {
  localId: string;
  moeosbbUserId: number;
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
        moeosbbUserId: remoteId,
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

/**
 * Sync the contract date for matched clients that carry a parseable createdt.
 * A client that already has a contract gets only its `signed_date` overwritten
 * (number/type/notes left intact); a client without one gets a new standard
 * contract with `number = moeosbb_user_id` (same convention as the manual form).
 */
async function syncContracts(
  datedUpdates: ClientUpdate[],
): Promise<{ contractsUpdated: number; contractsCreated: number }> {
  if (datedUpdates.length === 0) return { contractsUpdated: 0, contractsCreated: 0 };

  const clientIds = datedUpdates.map((u) => u.localId);
  const existingRows = await db
    .select({ clientId: contracts.clientId })
    .from(contracts)
    .where(inArray(contracts.clientId, clientIds));
  const hasContract = new Set(existingRows.map((r) => r.clientId));

  const updateResults = await Promise.allSettled(
    datedUpdates
      .filter((u) => hasContract.has(u.localId))
      .map((u) =>
        db
          .update(contracts)
          .set({ signedDate: u.contractDate as string, updatedAt: sql`now()` })
          .where(eq(contracts.clientId, u.localId)),
      ),
  );

  const createResults = await Promise.allSettled(
    datedUpdates
      .filter((u) => !hasContract.has(u.localId))
      .map((u) =>
        db.insert(contracts).values({
          clientId: u.localId,
          number: String(u.moeosbbUserId),
          signedDate: u.contractDate as string,
        }),
      ),
  );

  return {
    contractsUpdated: countFulfilled(updateResults),
    contractsCreated: countFulfilled(createResults),
  };
}

async function applySync(
  updates: ClientUpdate[],
  inserts: ClientInsert[],
): Promise<{
  updated: number;
  created: number;
  contractsUpdated: number;
  contractsCreated: number;
}> {
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

  const { contractsUpdated, contractsCreated } = await syncContracts(
    updates.filter((u) => u.contractDate !== null),
  );

  return {
    updated: countFulfilled(updateResults),
    created: countFulfilled(insertResults),
    contractsUpdated,
    contractsCreated,
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
    const { updated, created, contractsUpdated, contractsCreated } = await applySync(
      updates,
      inserts,
    );

    const matched = updates.length;
    const fetched = remoteClients.length;

    await recordIntegrationSuccess("moeosbb");
    logger.info(
      {
        event: "moeosbb.sync_complete",
        fetched,
        matched,
        updated,
        created,
        contractsUpdated,
        contractsCreated,
      },
      "moeosbb sync complete",
    );

    return { fetched, matched, updated, created, contractsUpdated, contractsCreated };
  } catch (err) {
    await recordIntegrationError("moeosbb", err);
    throw err;
  }
}

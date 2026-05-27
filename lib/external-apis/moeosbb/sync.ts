import { and, eq, isNotNull, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { clients } from "@/lib/db/schema/clients";
import { logger } from "@/lib/logging";
import { recordIntegrationError, recordIntegrationSuccess } from "@/lib/observability";

import { fetchMoeosbbClients } from "./client";
import { mapRemoteToClientFields } from "./mapper";

export interface SyncResult {
  fetched: number;
  matched: number;
  updated: number;
  created: number;
}

export async function runMoeosbbSync(singleMoeosbbId?: number): Promise<SyncResult> {
  try {
    const remoteClients = await fetchMoeosbbClients();

    const localClients = await db
      .select({ id: clients.id, moeosbbUserId: clients.moeosbbUserId })
      .from(clients)
      .where(and(isNotNull(clients.moeosbbUserId), eq(clients.autoActDisabled, false)));

    const localByMoeosbbId = new Map(localClients.map((c) => [c.moeosbbUserId!, c.id]));

    const updates: Array<{ localId: string; fields: ReturnType<typeof mapRemoteToClientFields> }> =
      [];
    const inserts: Array<{
      moeosbbUserId: number;
      fields: ReturnType<typeof mapRemoteToClientFields>;
    }> = [];

    for (const remote of remoteClients) {
      const remoteId = Number(remote.id);
      if (singleMoeosbbId !== undefined && remoteId !== singleMoeosbbId) continue;

      const localId = localByMoeosbbId.get(remoteId);
      if (localId) {
        updates.push({ localId, fields: mapRemoteToClientFields(remote) });
      } else if (singleMoeosbbId === undefined) {
        inserts.push({ moeosbbUserId: remoteId, fields: mapRemoteToClientFields(remote) });
      }
    }

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
        db.insert(clients).values({
          ...fields,
          moeosbbUserId,
          lastSyncAt: sql`now()`,
        }),
      ),
    );

    const matched = updates.length;
    const updated = updateResults.filter((r) => r.status === "fulfilled").length;
    const created = insertResults.filter((r) => r.status === "fulfilled").length;

    await recordIntegrationSuccess("moeosbb");
    logger.info(
      { event: "moeosbb.sync_complete", fetched: remoteClients.length, matched, updated, created },
      "moeosbb sync complete",
    );

    return { fetched: remoteClients.length, matched, updated, created };
  } catch (err) {
    await recordIntegrationError("moeosbb", err);
    throw err;
  }
}

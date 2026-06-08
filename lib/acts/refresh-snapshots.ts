import { eq, sql } from "drizzle-orm";

import { buildClientSnapshot, buildContractSnapshot } from "@/lib/classification/act-stub";
import { db } from "@/lib/db";
import { acts } from "@/lib/db/schema/acts";
import { clients } from "@/lib/db/schema/clients";
import { contracts } from "@/lib/db/schema/contracts";
import { logger } from "@/lib/logging";

/**
 * Rebuild an act's client + contract snapshots from the live client/contract.
 *
 * Act snapshots are frozen at creation, so a curated client field added later —
 * e.g. the short name used for the DubiDoc document title — never reaches an
 * older act. Calling this before regenerating an *editable* act (a never-sent
 * `draft`, or a `deleted` act removed in DubiDoc and awaiting re-send) flows the
 * current client/contract data into the regenerated PDF and the next send.
 *
 * A client has exactly one contract (unique index on `client_id`), so the
 * contract resolves unambiguously. Returns `false` (no-op) if the act, client,
 * or contract is missing. The caller MUST gate on an editable status — never
 * re-snapshot a `signed`/`sent_to_edo` act, whose content must stay as signed.
 */
export async function refreshActSnapshots(actId: string): Promise<boolean> {
  const [act] = await db
    .select({ clientId: acts.clientId })
    .from(acts)
    .where(eq(acts.id, actId))
    .limit(1);
  if (!act) return false;

  const [[client], [contract]] = await Promise.all([
    db.select().from(clients).where(eq(clients.id, act.clientId)).limit(1),
    db.select().from(contracts).where(eq(contracts.clientId, act.clientId)).limit(1),
  ]);
  if (!client || !contract) return false;

  await db
    .update(acts)
    .set({
      clientSnapshot: buildClientSnapshot(client),
      contractSnapshot: buildContractSnapshot(contract),
      updatedAt: sql`now()`,
    })
    .where(eq(acts.id, actId));

  logger.info(
    { event: "act.snapshots_refreshed", actId },
    "Act snapshots refreshed from live data",
  );
  return true;
}

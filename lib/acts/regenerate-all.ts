import { eq, sql } from "drizzle-orm";

import { buildServiceDescription } from "@/lib/classification/act-stub";
import type { ServiceType } from "@/lib/classification/types";
import { db } from "@/lib/db";
import { acts } from "@/lib/db/schema/acts";
import { logger } from "@/lib/logging";
import { getFopRequisites, type FopRequisites } from "@/lib/requisites";
import { getServiceNames, type ServiceNames } from "@/lib/services";

import { generateAndStoreActPdf } from "./generate-pdf";
import { reformatActNumber } from "./numbering";

export interface RegenerateAllResult {
  total: number;
  regenerated: number;
  backfilled: number;
  failed: number;
}

interface ActRow {
  id: string;
  number: string;
  actDate: string;
  serviceType: string;
  fopSnapshot: unknown;
}

/**
 * Recompute the service description from `service_type`, reformat the act number
 * to `MM/YYYY[/N]`, backfill `fop_snapshot` if absent, then re-render. Returns
 * whether the snapshot was backfilled. The description is rewritten for every
 * act (overwriting any manual edits) so existing acts adopt the current wording.
 */
async function regenerateOne(
  row: ActRow,
  requisites: FopRequisites | null,
  serviceNames: ServiceNames,
): Promise<boolean> {
  const update: {
    serviceDescription: string;
    number: string;
    updatedAt: ReturnType<typeof sql>;
    fopSnapshot?: FopRequisites;
  } = {
    serviceDescription: buildServiceDescription(row.serviceType as ServiceType, serviceNames),
    number: reformatActNumber(row.number, row.actDate),
    updatedAt: sql`now()`,
  };

  let backfilled = false;
  if (row.fopSnapshot === null) {
    if (requisites === null) {
      throw new Error("FOP requisites are not configured — cannot backfill fop_snapshot");
    }
    update.fopSnapshot = requisites;
    backfilled = true;
  }

  await db.update(acts).set(update).where(eq(acts.id, row.id));
  await generateAndStoreActPdf(row.id);
  return backfilled;
}

/**
 * One-off, idempotent re-render of every act through the current template.
 * Backfills `fop_snapshot` from current requisites where it is absent, then
 * regenerates the PDF and updates `pdf_file_url`. Does NOT touch EDO — only the
 * locally stored PDF is refreshed. Safe to run repeatedly.
 */
export async function regenerateAllActs(): Promise<RegenerateAllResult> {
  const [requisites, serviceNames] = await Promise.all([getFopRequisites(), getServiceNames()]);
  const rows = await db
    .select({
      id: acts.id,
      number: acts.number,
      actDate: acts.actDate,
      serviceType: acts.serviceType,
      fopSnapshot: acts.fopSnapshot,
    })
    .from(acts);

  const outcomes = await Promise.allSettled(
    rows.map((row) => regenerateOne(row, requisites, serviceNames)),
  );

  const result: RegenerateAllResult = {
    total: rows.length,
    regenerated: 0,
    backfilled: 0,
    failed: 0,
  };
  outcomes.forEach((outcome, i) => {
    if (outcome.status === "fulfilled") {
      result.regenerated += 1;
      if (outcome.value) result.backfilled += 1;
    } else {
      result.failed += 1;
      logger.error(
        { event: "act.regenerate_failed", actId: rows[i]?.id, error: outcome.reason },
        "regenerate failed",
      );
    }
  });

  logger.info({ event: "act.regenerate_all", ...result }, "acts regenerated");
  return result;
}

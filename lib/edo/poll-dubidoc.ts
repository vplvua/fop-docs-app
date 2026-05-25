import { and, eq, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { acts } from "@/lib/db/schema/acts";
import { payments } from "@/lib/db/schema/payments";
import { getDocumentStatus } from "@/lib/external-apis/dubidoc";
import { logger } from "@/lib/logging";
import { recordIntegrationError, recordIntegrationSuccess } from "@/lib/observability";

export interface PollResult {
  total: number;
  signed: number;
  deleted: number;
  refused: number;
  unchanged: number;
  errors: number;
}

type StatusOutcome = "signed" | "deleted" | "refused" | "unchanged";

async function applyStatusUpdate(
  actId: string,
  paymentId: string,
  response: { status: string; archived?: boolean; refused?: boolean },
): Promise<StatusOutcome> {
  if (response.status === "signed") {
    await db
      .update(acts)
      .set({ status: "signed", edoStatus: "signed", updatedAt: sql`now()` })
      .where(eq(acts.id, actId));
    return "signed";
  }

  if (response.archived) {
    await db
      .update(acts)
      .set({ status: "deleted", edoStatus: "archived", updatedAt: sql`now()` })
      .where(eq(acts.id, actId));
    await db
      .update(payments)
      .set({ actId: null, status: "received", updatedAt: sql`now()` })
      .where(eq(payments.id, paymentId));
    return "deleted";
  }

  if (response.refused) {
    await db
      .update(acts)
      .set({ edoStatus: "refused", updatedAt: sql`now()` })
      .where(eq(acts.id, actId));
    return "refused";
  }

  await db
    .update(acts)
    .set({ edoStatus: response.status, updatedAt: sql`now()` })
    .where(eq(acts.id, actId));
  return "unchanged";
}

async function pollSingleAct(act: {
  id: string;
  edoDocId: string | null;
  paymentId: string;
}): Promise<StatusOutcome | "error"> {
  if (!act.edoDocId) return "unchanged";

  try {
    const response = await getDocumentStatus(act.edoDocId);
    const outcome = await applyStatusUpdate(act.id, act.paymentId, response);

    if (outcome !== "unchanged") {
      logger.info(
        { event: "edo.status_updated", actId: act.id, outcome, edoDocId: act.edoDocId },
        `DubiDoc status: ${outcome}`,
      );
    }
    return outcome;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown";
    logger.error(
      { event: "edo.poll_error", actId: act.id, edoDocId: act.edoDocId, error: message },
      "DubiDoc poll error for act",
    );
    return "error";
  }
}

function aggregateResults(outcomes: PromiseSettledResult<StatusOutcome | "error">[]): PollResult {
  const result: PollResult = {
    total: outcomes.length,
    signed: 0,
    deleted: 0,
    refused: 0,
    unchanged: 0,
    errors: 0,
  };

  for (const o of outcomes) {
    if (o.status === "rejected" || o.value === "error") {
      result.errors++;
    } else {
      result[o.value]++;
    }
  }

  return result;
}

export async function pollDubidocStatuses(): Promise<PollResult> {
  const pendingActs = await db
    .select({ id: acts.id, edoDocId: acts.edoDocId, paymentId: acts.paymentId })
    .from(acts)
    .where(and(eq(acts.status, "sent_to_edo"), eq(acts.edoProvider, "dubidoc")));

  if (pendingActs.length === 0) {
    return { total: 0, signed: 0, deleted: 0, refused: 0, unchanged: 0, errors: 0 };
  }

  const outcomes = await Promise.allSettled(pendingActs.map(pollSingleAct));
  const result = aggregateResults(outcomes);

  if (result.errors === 0 || result.errors < result.total) {
    await recordIntegrationSuccess("dubidoc");
  } else {
    await recordIntegrationError("dubidoc", new Error("All DubiDoc polls failed"));
  }

  return result;
}

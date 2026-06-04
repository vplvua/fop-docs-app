import { and, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { acts, EDO_PENDING_STATUSES } from "@/lib/db/schema/acts";
import { payments } from "@/lib/db/schema/payments";
import {
  DubiDocApiError,
  type DocumentStatusResponse,
  getDocumentStatus,
} from "@/lib/external-apis/dubidoc";
import { logger } from "@/lib/logging";
import { recordIntegrationError, recordIntegrationSuccess } from "@/lib/observability";

import { mapDubidocStatus } from "./dubidoc-status";

export interface PollResult {
  total: number;
  signed: number;
  waiting: number;
  deleted: number;
  refused: number;
  unchanged: number;
  reset: number;
  errors: number;
}

type StatusOutcome = "signed" | "waiting" | "deleted" | "refused" | "unchanged" | "reset";

async function resetActToDraft(actId: string): Promise<void> {
  await db
    .update(acts)
    .set({
      status: "draft",
      edoDocId: null,
      edoStatus: null,
      sentToEdoAt: null,
      updatedAt: sql`now()`,
    })
    .where(eq(acts.id, actId));
}

async function applyStatusUpdate(
  actId: string,
  paymentId: string,
  response: DocumentStatusResponse,
): Promise<StatusOutcome> {
  const patch = mapDubidocStatus(response);

  await db
    .update(acts)
    .set({
      ...(patch.status ? { status: patch.status } : {}),
      edoStatus: patch.edoStatus,
      updatedAt: sql`now()`,
    })
    .where(eq(acts.id, actId));

  // An archived DubiDoc document deletes the act and frees its payment for
  // re-classification (FR-EDGE-01).
  if (patch.status === "deleted") {
    await db
      .update(payments)
      .set({ actId: null, status: "received", updatedAt: sql`now()` })
      .where(eq(payments.id, paymentId));
    return "deleted";
  }
  if (patch.status === "signed") return "signed";
  if (patch.status === "waiting_for_client_sign") return "waiting";
  if (patch.edoStatus === "refused") return "refused";
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
    if (err instanceof DubiDocApiError && err.statusCode === 404) {
      await resetActToDraft(act.id);
      logger.info(
        { event: "edo.act_reset", actId: act.id, edoDocId: act.edoDocId },
        "DubiDoc document not found, act reset to draft",
      );
      return "reset";
    }
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
    waiting: 0,
    deleted: 0,
    refused: 0,
    unchanged: 0,
    reset: 0,
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
  // Both pending states (sent_to_edo = awaiting the FOP, waiting_for_client_sign
  // = awaiting the client) must keep being polled so the act can reach `signed`.
  const pendingActs = await db
    .select({ id: acts.id, edoDocId: acts.edoDocId, paymentId: acts.paymentId })
    .from(acts)
    .where(and(inArray(acts.status, EDO_PENDING_STATUSES), eq(acts.edoProvider, "dubidoc")));

  if (pendingActs.length === 0) {
    return {
      total: 0,
      signed: 0,
      waiting: 0,
      deleted: 0,
      refused: 0,
      unchanged: 0,
      reset: 0,
      errors: 0,
    };
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

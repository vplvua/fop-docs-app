import { and, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { acts, EDO_PENDING_STATUSES } from "@/lib/db/schema/acts";
import {
  DubiDocApiError,
  type DocumentStatusResponse,
  getDocumentParticipants,
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
  errors: number;
}

type StatusOutcome = "signed" | "waiting" | "deleted" | "refused" | "unchanged";

/**
 * Mark an act as removed in DubiDoc (deleted before signing → 404, or cancelled
 * after signing → `status = "cancelled"`). The act and its payment are KEPT (the
 * payment ↔ act pairing survives) so the act can be re-sent; the prior hash is
 * forgotten so a fresh document is created on re-send. Removed acts are excluded
 * from `EDO_PENDING_STATUSES`, so polling stops until they are re-sent.
 */
async function markActRemoved(actId: string): Promise<void> {
  await db
    .update(acts)
    .set({
      status: "deleted",
      edoDocId: null,
      edoStatus: null,
      sentToEdoAt: null,
      updatedAt: sql`now()`,
    })
    .where(eq(acts.id, actId));
}

async function applyStatusUpdate(
  actId: string,
  edoDocId: string,
  response: DocumentStatusResponse,
): Promise<StatusOutcome> {
  const patch = await mapDubidocStatus(response, () => getDocumentParticipants(edoDocId));

  // A cancelled DubiDoc document removes the act's live copy but keeps the act
  // and its payment so it can be re-sent — no payment-freeing/re-classification.
  if (patch.status === "deleted") {
    await markActRemoved(actId);
    return "deleted";
  }

  await db
    .update(acts)
    .set({
      ...(patch.status ? { status: patch.status } : {}),
      edoStatus: patch.edoStatus,
      updatedAt: sql`now()`,
    })
    .where(eq(acts.id, actId));

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
    const outcome = await applyStatusUpdate(act.id, act.edoDocId, response);

    if (outcome !== "unchanged") {
      logger.info(
        { event: "edo.status_updated", actId: act.id, outcome, edoDocId: act.edoDocId },
        `DubiDoc status: ${outcome}`,
      );
    }
    return outcome;
  } catch (err) {
    if (err instanceof DubiDocApiError && err.statusCode === 404) {
      await markActRemoved(act.id);
      logger.info(
        { event: "edo.act_removed", actId: act.id, edoDocId: act.edoDocId },
        "DubiDoc document not found, act marked removed",
      );
      return "deleted";
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

// DubiDoc rate-limits (429, Retry-After: 60s). Polling every pending act at once
// trips the limit hard; process a few at a time so a growing backlog of acts
// does not stall the whole poll (and hang the manual «Опитати статуси» button).
const POLL_CONCURRENCY = 4;

async function pollInBatches(
  pending: { id: string; edoDocId: string | null; paymentId: string }[],
): Promise<PromiseSettledResult<StatusOutcome | "error">[]> {
  const outcomes: PromiseSettledResult<StatusOutcome | "error">[] = [];
  for (let i = 0; i < pending.length; i += POLL_CONCURRENCY) {
    const batch = pending.slice(i, i + POLL_CONCURRENCY);
    // Batches are intentionally sequential — that is the rate-limit throttle.
    // eslint-disable-next-line no-await-in-loop
    outcomes.push(...(await Promise.allSettled(batch.map((act) => pollSingleAct(act)))));
  }
  return outcomes;
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
      errors: 0,
    };
  }

  const outcomes = await pollInBatches(pendingActs);
  const result = aggregateResults(outcomes);

  if (result.errors === 0 || result.errors < result.total) {
    await recordIntegrationSuccess("dubidoc");
  } else {
    await recordIntegrationError("dubidoc", new Error("All DubiDoc polls failed"));
  }

  return result;
}

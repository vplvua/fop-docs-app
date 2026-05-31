import { eq, sql } from "drizzle-orm";

import { buildManualActStub } from "@/lib/classification/act-stub";
import type { ServiceType } from "@/lib/classification/types";
import { dbPool, schema } from "@/lib/db";
import type { Client } from "@/lib/db/schema/clients";
import type { Contract } from "@/lib/db/schema/contracts";
import { sendActToDubidoc } from "@/lib/edo/send-to-dubidoc";
import { logger } from "@/lib/logging";
import { getFopRequisites } from "@/lib/requisites";
import { getServiceNames } from "@/lib/services";

import { generateAndStoreActPdf } from "./generate-pdf";
import { manualActDate } from "./manual-act-id";
import { nextActNumber } from "./numbering";
import { isSplitPayment, preSplitStatus, splitOriginMarker } from "./split-origin";
import { reconcilesExactly } from "./split-payment-schema";

/** Payment statuses a payment may be split from (skipped is included — split is
 * the path that reverses a skip, D-042 / D5). */
const SPLITTABLE = new Set(["received", "awaiting_review", "in_queue", "skipped"]);

export interface SplitLine {
  client: Client;
  contract: Contract;
  /** 1-12. */
  periodMonth: number;
  periodYear: number;
  serviceType: ServiceType;
  unitPrice: string;
  quantity: string;
  /** Authoritative paid slice, stored verbatim. */
  amount: string;
}

export interface SplitPaymentResult {
  paymentId: string;
  acts: { actId: string; edoProvider: "dubidoc" | "vchasno_external" }[];
}

type Tx = Parameters<Parameters<typeof dbPool.transaction>[0]>[0];

/**
 * Insert one act per line, all referencing the existing payment. Sequential by
 * necessity: each `nextActNumber` runs `SELECT … FOR UPDATE` and counts acts
 * already inserted in this transaction, so lines for the same client + month
 * number `MM/YYYY`, `MM/YYYY/2`, … — parallelising would race the counter.
 */
async function insertSplitActs(
  tx: Tx,
  paymentId: string,
  lines: SplitLine[],
  serviceNames: Awaited<ReturnType<typeof getServiceNames>>,
  fopSnapshot: Awaited<ReturnType<typeof getFopRequisites>>,
): Promise<SplitPaymentResult["acts"]> {
  const acts: SplitPaymentResult["acts"] = [];
  for (const line of lines) {
    const actDate = manualActDate(line.periodYear, line.periodMonth);
    const stub = buildManualActStub({
      client: line.client,
      contract: line.contract,
      paymentId,
      serviceType: line.serviceType,
      unitPrice: line.unitPrice,
      quantity: line.quantity,
      amount: line.amount,
      actDate,
      serviceNames,
    });
    // eslint-disable-next-line no-await-in-loop -- numbering must see prior inserts
    stub.number = await nextActNumber(tx, line.client.id, actDate);
    stub.fopSnapshot = fopSnapshot;
    // eslint-disable-next-line no-await-in-loop -- sequential so the next number is correct
    const [row] = await tx.insert(schema.acts).values(stub).returning({ id: schema.acts.id });
    acts.push({ actId: row!.id, edoProvider: line.client.edoProvider });
  }
  return acts;
}

/**
 * Generate each act's PDF then auto-send to DubiDoc, mirroring the manual-act
 * path. Fire-and-forget — a failure leaves that act `draft` with
 * `pdf_file_url = NULL`, recoverable via the act page.
 */
function firePdfAndSend(acts: SplitPaymentResult["acts"]): void {
  for (const act of acts) {
    generateAndStoreActPdf(act.actId)
      .then(() => (act.edoProvider === "dubidoc" ? sendActToDubidoc(act.actId) : undefined))
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : "Unknown";
        logger.warn(
          { event: "payment.split.pdf_send_error", actId: act.actId, error: message },
          "split act pdf/send failed",
        );
      });
  }
}

/**
 * Split one existing real payment into N acts in a single transaction, then fire
 * PDF generation + EDO send per act after commit. No new payment is created —
 * every act references the existing payment, and the payment becomes
 * `classified` (D-042). The line amounts MUST reconcile exactly to the payment
 * amount. The pre-split status is stamped on `classification_reason` so a later
 * cancel can restore it.
 */
export async function splitPayment(
  paymentId: string,
  lines: SplitLine[],
): Promise<SplitPaymentResult> {
  if (lines.length === 0) throw new Error("Потрібен щонайменше один рядок");

  const [serviceNames, fopSnapshot] = await Promise.all([getServiceNames(), getFopRequisites()]);

  const result = await dbPool.transaction(async (tx) => {
    const [payment] = await tx
      .select({ amount: schema.payments.amount, status: schema.payments.status })
      .from(schema.payments)
      .where(eq(schema.payments.id, paymentId))
      .for("update");

    if (!payment) throw new Error("Платіж не знайдено");
    if (!SPLITTABLE.has(payment.status)) {
      throw new Error(`Платіж у статусі "${payment.status}" не можна розділити`);
    }
    if (
      !reconcilesExactly(
        payment.amount,
        lines.map((l) => l.amount),
      )
    ) {
      throw new Error("Сума рядків має точно дорівнювати сумі платежу");
    }

    const acts = await insertSplitActs(tx, paymentId, lines, serviceNames, fopSnapshot);

    await tx
      .update(schema.payments)
      .set({
        status: "classified",
        // Denormalised pointers; the canonical act set is `acts WHERE payment_id`.
        clientId: lines[0]!.client.id,
        actId: acts[0]!.actId,
        // Remember the pre-split status for a true cancel-undo + mark as split.
        classificationReason: splitOriginMarker(payment.status),
        // The single-value mirror columns are meaningless for a multi-act split.
        serviceType: null,
        unitPrice: null,
        quantity: null,
        quantityUnit: null,
        updatedAt: sql`now()`,
      })
      .where(eq(schema.payments.id, paymentId));

    return { paymentId, acts };
  });

  logger.info(
    { event: "payment.split", paymentId, actCount: result.acts.length },
    "payment split into acts",
  );
  firePdfAndSend(result.acts);
  return result;
}

/**
 * Cancel a split: delete all acts backing the payment and restore its pre-split
 * status. Allowed only while every linked act is still `draft` — once any act is
 * `sent_to_edo` / `signed`, an external document exists and the split cannot be
 * unwound. Deleting the acts nulls `payments.act_id` via its `ON DELETE SET NULL`
 * FK; the status is restored from the `split_origin:` marker (skipped→skipped,
 * otherwise received).
 */
export async function cancelSplit(paymentId: string): Promise<void> {
  await dbPool.transaction(async (tx) => {
    const [payment] = await tx
      .select({ status: schema.payments.status, reason: schema.payments.classificationReason })
      .from(schema.payments)
      .where(eq(schema.payments.id, paymentId))
      .for("update");

    if (!payment) throw new Error("Платіж не знайдено");
    if (!isSplitPayment(payment.reason)) {
      throw new Error("Платіж не має розділення для скасування");
    }

    const actRows = await tx
      .select({ status: schema.acts.status })
      .from(schema.acts)
      .where(eq(schema.acts.paymentId, paymentId));

    if (actRows.some((a) => a.status !== "draft")) {
      throw new Error("Скасувати не можна: акт уже відправлено в ЕДО або підписано");
    }

    await tx.delete(schema.acts).where(eq(schema.acts.paymentId, paymentId));

    await tx
      .update(schema.payments)
      .set({
        status: preSplitStatus(payment.reason),
        actId: null,
        clientId: null,
        classificationReason: null,
        updatedAt: sql`now()`,
      })
      .where(eq(schema.payments.id, paymentId));
  });

  logger.info({ event: "payment.split_cancelled", paymentId }, "payment split cancelled");
}

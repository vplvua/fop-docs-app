"use server";

import { eq, sql } from "drizzle-orm";

import { runClassification } from "@/lib/classification/run-classification";
import { db } from "@/lib/db";
import { payments } from "@/lib/db/schema/payments";
import { logger } from "@/lib/logging";

const RECLASSIFIABLE = new Set(["received", "awaiting_review", "in_queue"]);

export async function classifyPaymentAction(
  paymentId: string,
): Promise<{ ok: boolean; error?: string }> {
  const [payment] = await db
    .select({ status: payments.status })
    .from(payments)
    .where(eq(payments.id, paymentId))
    .limit(1);

  if (!payment) return { ok: false, error: "Платіж не знайдено" };
  if (!RECLASSIFIABLE.has(payment.status)) {
    return { ok: false, error: `Платіж у статусі "${payment.status}" не може бути класифікований` };
  }

  try {
    await runClassification(paymentId);
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown";
    logger.error({ event: "action.classify_error", paymentId, error: msg }, "classify failed");
    return { ok: false, error: msg };
  }
}

const SKIPPABLE = new Set(["received", "awaiting_review", "in_queue"]);

export async function skipPaymentAction(
  paymentId: string,
): Promise<{ ok: boolean; error?: string }> {
  const [payment] = await db
    .select({ status: payments.status })
    .from(payments)
    .where(eq(payments.id, paymentId))
    .limit(1);

  if (!payment) return { ok: false, error: "Платіж не знайдено" };
  if (!SKIPPABLE.has(payment.status)) {
    return { ok: false, error: `Платіж у статусі "${payment.status}" не може бути пропущений` };
  }

  await db
    .update(payments)
    .set({ status: "skipped", updatedAt: sql`now()` })
    .where(eq(payments.id, paymentId));

  logger.info({ event: "payment.skipped", paymentId }, "payment skipped");
  return { ok: true };
}

"use server";

import { eq, sql } from "drizzle-orm";

import { isClientLinkableToPayment } from "@/lib/classification/link-validation";
import { runClassification } from "@/lib/classification/run-classification";
import { db } from "@/lib/db";
import { clients } from "@/lib/db/schema/clients";
import { contracts } from "@/lib/db/schema/contracts";
import { payments } from "@/lib/db/schema/payments";
import { logger } from "@/lib/logging";
import { getTransitEdrpouList } from "@/lib/settings";

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

/**
 * Manually link a payment to a specific client and re-run classification for it.
 * Guardrail: the chosen client must belong to the payer — its `legal_id` must
 * equal `payment.payer_legal_id` (non-transit), or, for transit payers, the
 * client must be identified by one of the payment's parsed contract numbers.
 */
export async function linkPaymentClientAction(
  paymentId: string,
  clientId: string,
): Promise<{ ok: boolean; error?: string }> {
  const [payment] = await db
    .select({
      status: payments.status,
      payerLegalId: payments.payerLegalId,
      parsedContractNumbers: payments.parsedContractNumbers,
    })
    .from(payments)
    .where(eq(payments.id, paymentId))
    .limit(1);

  if (!payment) return { ok: false, error: "Платіж не знайдено" };
  if (!RECLASSIFIABLE.has(payment.status)) {
    return { ok: false, error: `Платіж у статусі "${payment.status}" не може бути привʼязаний` };
  }

  const [client] = await db
    .select({ legalId: clients.legalId, contractNumber: contracts.number })
    .from(clients)
    .leftJoin(contracts, eq(contracts.clientId, clients.id))
    .where(eq(clients.id, clientId))
    .limit(1);

  if (!client) return { ok: false, error: "Клієнта не знайдено" };

  const transitList = await getTransitEdrpouList();
  const linkable = isClientLinkableToPayment({
    isTransit: transitList.includes(payment.payerLegalId),
    payerLegalId: payment.payerLegalId,
    clientLegalId: client.legalId,
    clientContractNumber: client.contractNumber,
    parsedContractNumbers: payment.parsedContractNumbers ?? [],
  });
  if (!linkable) {
    return {
      ok: false,
      error: "Можна привʼязати лише клієнта з тим самим ЄДРПОУ, що й платник",
    };
  }

  try {
    await runClassification(paymentId, clientId);
    logger.info({ event: "payment.client_linked", paymentId, clientId }, "payment client linked");
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown";
    logger.error({ event: "action.link_error", paymentId, clientId, error: msg }, "link failed");
    return { ok: false, error: msg };
  }
}

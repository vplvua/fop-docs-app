"use server";

import { eq, inArray } from "drizzle-orm";

import { cancelSplit, splitPayment, type SplitLine } from "@/lib/acts/split-payment";
import { reconcilesExactly, splitPaymentFormSchema } from "@/lib/acts/split-payment-schema";
import { suggestManualActPricing } from "@/lib/acts/manual-act-hint";
import { manualActDate } from "@/lib/acts/manual-act-id";
import { getTransitEdrpouList } from "@/lib/settings";
import { db } from "@/lib/db";
import { clients } from "@/lib/db/schema/clients";
import { contracts } from "@/lib/db/schema/contracts";
import { payments } from "@/lib/db/schema/payments";
import { smsPrices, tariffs } from "@/lib/db/schema/tariffs";
import { logger } from "@/lib/logging";

const SPLITTABLE = new Set(["received", "awaiting_review", "in_queue", "skipped"]);

export interface SplitPaymentResponse {
  actIds?: string[];
  error?: string;
  fieldErrors?: Record<string, string[]>;
}

/**
 * Validate the split form server-side and split the payment into acts. The
 * client-supplied prices/amounts are never trusted without this Zod pass + the
 * exact reconciliation check; every line's client must have a contract (required
 * for the PDF preamble).
 */
export async function splitPaymentAction(input: unknown): Promise<SplitPaymentResponse> {
  const parsed = splitPaymentFormSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Перевірте поля форми", fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const data = parsed.data;

  const [payment] = await db
    .select({
      amount: payments.amount,
      status: payments.status,
      payerLegalId: payments.payerLegalId,
    })
    .from(payments)
    .where(eq(payments.id, data.paymentId))
    .limit(1);
  if (!payment) return { error: "Платіж не знайдено" };
  if (!SPLITTABLE.has(payment.status)) {
    return { error: `Платіж у статусі "${payment.status}" не можна розділити` };
  }
  if (
    !reconcilesExactly(
      payment.amount,
      data.lines.map((l) => l.amount),
    )
  ) {
    return { error: `Сума рядків має точно дорівнювати сумі платежу (${payment.amount} грн)` };
  }

  // A transit/aggregated payer EDRPOU belongs to the intermediary bank, so the
  // split is not anchored to it — lines may target different clients (D-008/
  // D-027). For a normal payer every act must belong to that payer's EDRPOU.
  const transitList = await getTransitEdrpouList();
  const isTransit = transitList.includes(payment.payerLegalId);

  const clientIds = [...new Set(data.lines.map((l) => l.clientId))];
  const clientRows = await db.select().from(clients).where(inArray(clients.id, clientIds));
  const contractRows = await db
    .select()
    .from(contracts)
    .where(inArray(contracts.clientId, clientIds));
  const clientById = new Map(clientRows.map((c) => [c.id, c]));
  const contractByClient = new Map(contractRows.map((c) => [c.clientId, c]));

  const lines: SplitLine[] = [];
  for (const l of data.lines) {
    const client = clientById.get(l.clientId);
    const contract = contractByClient.get(l.clientId);
    if (!client) return { error: "Клієнта не знайдено" };
    // For a normal payer every act belongs to the payment's payer (EDRPOU).
    // The form fixes this, but re-check server-side so a tampered submission
    // cannot attach acts to an unrelated client. Skipped for transit payers,
    // whose EDRPOU does not identify the client.
    if (!isTransit && client.legalId !== payment.payerLegalId) {
      return { error: "Акт можна створити лише для платника цього платежу" };
    }
    if (!contract) return { error: `У клієнта «${client.name}» немає договору — акт неможливий` };
    lines.push({
      client,
      contract,
      periodMonth: l.periodMonth,
      periodYear: l.periodYear,
      serviceType: l.serviceType,
      unitPrice: l.unitPrice,
      quantity: l.quantity,
      amount: l.amount,
    });
  }

  try {
    const result = await splitPayment(data.paymentId, lines);
    return { actIds: result.acts.map((a) => a.actId) };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Невідома помилка";
    logger.error({ event: "split.action_error", error: message }, "payment split failed");
    return { error: `Не вдалося розділити платіж: ${message}` };
  }
}

export async function cancelSplitAction(
  paymentId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await cancelSplit(paymentId);
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Невідома помилка";
    logger.error({ event: "split.cancel_error", paymentId, error: message }, "cancel split failed");
    return { ok: false, error: message };
  }
}

export interface HintResponse {
  unitPrice: string | null;
  defaultQuantity: string;
}

/**
 * Tariff hint for a split line: suggest a unit price + default quantity for the
 * selected client/service as of the chosen period end. Tariffs stay server-side.
 */
export async function splitLineHintAction(
  clientId: string,
  serviceType: "access" | "sms",
  periodYear: number,
  periodMonth: number,
): Promise<HintResponse> {
  const [client] = await db
    .select({
      apartmentsCount: clients.apartmentsCount,
      accessPriceOverride: clients.accessPriceOverride,
    })
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);
  if (!client) return { unitPrice: null, defaultQuantity: "1" };

  const [allTariffs, allSmsPrices] = await Promise.all([
    db.select().from(tariffs),
    db.select().from(smsPrices),
  ]);

  return suggestManualActPricing({
    client,
    serviceType,
    tariffs: allTariffs,
    smsPrices: allSmsPrices,
    asOf: manualActDate(periodYear, periodMonth),
  });
}

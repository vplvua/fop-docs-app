"use server";

import { eq } from "drizzle-orm";

import { createManualAct } from "@/lib/acts/create-manual-act";
import { suggestManualActPricing } from "@/lib/acts/manual-act-hint";
import { manualActFormSchema, type ManualActFormInput } from "@/lib/acts/manual-act-schema";
import { manualActDate } from "@/lib/acts/manual-act-id";
import { db } from "@/lib/db";
import { clients } from "@/lib/db/schema/clients";
import { contracts } from "@/lib/db/schema/contracts";
import { smsPrices, tariffs } from "@/lib/db/schema/tariffs";
import { logger } from "@/lib/logging";

export interface CreateManualActResponse {
  actId?: string;
  error?: string;
  fieldErrors?: Record<string, string[]>;
}

/**
 * Validate the manual-act form server-side and create the act + backing payment.
 * The client-supplied price/amount are never trusted without this Zod pass; the
 * client must have a contract (required for the PDF preamble).
 */
export async function createManualActAction(
  input: ManualActFormInput,
): Promise<CreateManualActResponse> {
  const parsed = manualActFormSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Перевірте поля форми", fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const data = parsed.data;

  const [client] = await db.select().from(clients).where(eq(clients.id, data.clientId)).limit(1);
  if (!client) return { error: "Клієнта не знайдено" };

  const [contract] = await db
    .select()
    .from(contracts)
    .where(eq(contracts.clientId, data.clientId))
    .limit(1);
  if (!contract) return { error: "У клієнта немає договору — акт неможливо створити" };

  try {
    const { actId } = await createManualAct({
      client,
      contract,
      periodMonth: data.periodMonth,
      periodYear: data.periodYear,
      serviceType: data.serviceType,
      unitPrice: data.unitPrice,
      quantity: data.quantity,
      amount: data.amount,
      bankLabel: data.bankLabel,
      paymentDate: data.paymentDate,
    });
    return { actId };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Невідома помилка";
    logger.error({ event: "manual_act.action_error", error: message }, "manual act create failed");
    return { error: `Не вдалося створити акт: ${message}` };
  }
}

export interface HintResponse {
  unitPrice: string | null;
  defaultQuantity: string;
}

/**
 * Tariff-hint for the form: suggest a unit price + default quantity for the
 * selected client/service as of the chosen period end. Tariffs stay server-side.
 */
export async function manualActHintAction(
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

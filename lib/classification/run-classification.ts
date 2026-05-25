import { and, eq, sql } from "drizzle-orm";

import { dbPool, schema } from "@/lib/db";
import { logger } from "@/lib/logging";
import { getContractPatterns, getSmsKeywords, getTransitEdrpouList } from "@/lib/settings";

import { classify } from "./classify";
import { lastDayOfMonth } from "./act-stub";
import type { ClassificationResult } from "./types";

type Tx = Parameters<Parameters<typeof dbPool.transaction>[0]>[0];

async function fetchClassificationData(tx: Tx, paymentId: string) {
  const [payment] = await tx
    .select()
    .from(schema.payments)
    .where(eq(schema.payments.id, paymentId))
    .for("update");

  if (!payment) throw new Error(`Payment ${paymentId} not found`);
  if (payment.status === "classified" || payment.status === "skipped") {
    throw new Error(`Payment ${paymentId} is already ${payment.status}`);
  }

  const [allClients, allContracts, allTariffs, allSmsPrices] = await Promise.all([
    tx.select().from(schema.clients),
    tx.select().from(schema.contracts),
    tx.select().from(schema.tariffs),
    tx.select().from(schema.smsPrices),
  ]);

  const contractMap = new Map(allContracts.map((ct) => [ct.clientId, ct]));
  const clientsWithContracts = allClients.map((c) =>
    Object.assign(c, { contract: contractMap.get(c.id) ?? null }),
  );

  return { payment, clientsWithContracts, allTariffs, allSmsPrices };
}

async function countExistingActs(tx: Tx, clientId: string, actDate: string): Promise<number> {
  const [row] = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.acts)
    .where(and(eq(schema.acts.clientId, clientId), eq(schema.acts.actDate, actDate)));
  return row?.count ?? 0;
}

async function writeClassifiedResult(
  tx: Tx,
  paymentId: string,
  result: Extract<ClassificationResult, { status: "classified" }>,
) {
  const [newAct] = await tx
    .insert(schema.acts)
    .values(result.actStub)
    .returning({ id: schema.acts.id });

  await tx
    .update(schema.payments)
    .set({
      status: "classified",
      classificationReason: null,
      parsedContractNumbers: result.parsedContractNumbers,
      clientId: result.clientId,
      serviceType: result.serviceType,
      unitPrice: result.unitPrice,
      quantity: result.quantity,
      quantityUnit: result.quantityUnit,
      actId: newAct!.id,
      updatedAt: sql`now()`,
    })
    .where(eq(schema.payments.id, paymentId));

  logger.info(
    { event: "classification.success", paymentId, clientId: result.clientId, actId: newAct!.id },
    "payment classified",
  );
}

async function writeQueueResult(
  tx: Tx,
  paymentId: string,
  result: Extract<ClassificationResult, { status: "awaiting_review" | "in_queue" }>,
) {
  await tx
    .update(schema.payments)
    .set({
      status: result.status,
      classificationReason: result.reason,
      parsedContractNumbers: result.parsedContractNumbers,
      clientId: result.clientId,
      serviceType: result.serviceType,
      updatedAt: sql`now()`,
    })
    .where(eq(schema.payments.id, paymentId));

  logger.info(
    { event: `classification.${result.status}`, paymentId, reason: result.reason },
    `payment ${result.status}`,
  );
}

export async function runClassification(paymentId: string): Promise<ClassificationResult> {
  const [patterns, smsKeywords, transitEdrpouList] = await Promise.all([
    getContractPatterns(),
    getSmsKeywords(),
    getTransitEdrpouList(),
  ]);

  return dbPool.transaction(async (tx) => {
    const { payment, clientsWithContracts, allTariffs, allSmsPrices } =
      await fetchClassificationData(tx, paymentId);

    const actDate = lastDayOfMonth(payment.paymentDate);
    const matched = clientsWithContracts.find((c) => c.legalId === payment.payerLegalId);
    const existingActCount = matched ? await countExistingActs(tx, matched.id, actDate) : 0;

    const result = classify({
      payment,
      clients: clientsWithContracts,
      patterns,
      smsKeywords,
      transitEdrpouList,
      tariffs: allTariffs,
      smsPrices: allSmsPrices,
      existingActCount,
    });

    if (result.status === "classified") {
      await writeClassifiedResult(tx, paymentId, result);
    } else {
      await writeQueueResult(tx, paymentId, result);
    }

    return result;
  });
}

import { eq, sql } from "drizzle-orm";

import { generateAndStoreActPdf } from "@/lib/acts/generate-pdf";
import { nextActNumber } from "@/lib/acts/numbering";
import { dbPool, schema } from "@/lib/db";
import { logger } from "@/lib/logging";
import type { FopRequisites } from "@/lib/requisites";
import { getFopRequisites } from "@/lib/requisites";
import { getServiceNames } from "@/lib/services";
import { getContractPatterns, getSmsKeywords, getTransitEdrpouList } from "@/lib/settings";

import { classify } from "./classify";
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

async function writeClassifiedResult(
  tx: Tx,
  paymentId: string,
  result: Extract<ClassificationResult, { status: "classified" }>,
): Promise<string> {
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

  return newAct!.id;
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

async function finalizeClassifiedAct(
  tx: Tx,
  paymentId: string,
  classResult: Extract<ClassificationResult, { status: "classified" }>,
  fopSnapshot: FopRequisites | null,
): Promise<string> {
  const actNumber = await nextActNumber(
    tx,
    classResult.actStub.clientId,
    classResult.actStub.actDate,
  );
  classResult.actStub.number = actNumber;
  classResult.actStub.fopSnapshot = fopSnapshot;
  return writeClassifiedResult(tx, paymentId, classResult);
}

export async function runClassification(
  paymentId: string,
  forcedClientId?: string,
): Promise<ClassificationResult> {
  const [patterns, smsKeywords, transitEdrpouList, fopRequisites, serviceNames] = await Promise.all(
    [
      getContractPatterns(),
      getSmsKeywords(),
      getTransitEdrpouList(),
      getFopRequisites(),
      getServiceNames(),
    ],
  );

  const result = await dbPool.transaction(async (tx) => {
    const { payment, clientsWithContracts, allTariffs, allSmsPrices } =
      await fetchClassificationData(tx, paymentId);

    const forcedClient = forcedClientId
      ? clientsWithContracts.find((c) => c.id === forcedClientId)
      : undefined;
    if (forcedClientId && !forcedClient) {
      throw new Error(`Client ${forcedClientId} not found`);
    }

    const classResult = classify({
      payment,
      clients: clientsWithContracts,
      patterns,
      smsKeywords,
      transitEdrpouList,
      tariffs: allTariffs,
      smsPrices: allSmsPrices,
      serviceNames,
      existingActCount: 0,
      ...(forcedClient ? { forcedClient } : {}),
    });

    if (classResult.status === "classified") {
      const actId = await finalizeClassifiedAct(tx, paymentId, classResult, fopRequisites);
      return { classResult, actId };
    }

    await writeQueueResult(tx, paymentId, classResult);
    return { classResult, actId: null };
  });

  if (result.actId) {
    generateAndStoreActPdf(result.actId).catch(() => {});
  }

  return result.classResult;
}

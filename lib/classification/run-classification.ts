import { eq, sql } from "drizzle-orm";

import { generateAndStoreActPdf } from "@/lib/acts/generate-pdf";
import { nextActNumber } from "@/lib/acts/numbering";
import { dbPool, schema } from "@/lib/db";
import { logger } from "@/lib/logging";
import type { FopRequisites } from "@/lib/requisites";
import { getFopRequisites } from "@/lib/requisites";
import { getServiceNames } from "@/lib/services";
import {
  getAnnualPaidMonths,
  getContractPatterns,
  getSmsKeywords,
  getTransitEdrpouList,
} from "@/lib/settings";

import { classify } from "./classify";
import type { ClassificationResult } from "./types";

type Tx = Parameters<Parameters<typeof dbPool.transaction>[0]>[0];

/**
 * Loads the payment (locked `FOR UPDATE`) and the data the classifier needs.
 * When the locked row is already in a terminal classification state
 * (`classified` or `skipped`), returns `{ alreadyFinal: true }` instead of
 * throwing — a concurrent/redundant trigger is an idempotent no-op, not an
 * error (FR-CLASS-15). A genuinely missing payment still throws.
 */
async function fetchClassificationData(tx: Tx, paymentId: string) {
  const [payment] = await tx
    .select()
    .from(schema.payments)
    .where(eq(schema.payments.id, paymentId))
    .for("update");

  if (!payment) throw new Error(`Payment ${paymentId} not found`);
  if (payment.status === "classified" || payment.status === "skipped") {
    return { alreadyFinal: true as const, status: payment.status };
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

  return { alreadyFinal: false as const, payment, clientsWithContracts, allTariffs, allSmsPrices };
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

async function loadClassificationSettings() {
  const [patterns, smsKeywords, transitEdrpouList, fopRequisites, serviceNames, annualPaidMonths] =
    await Promise.all([
      getContractPatterns(),
      getSmsKeywords(),
      getTransitEdrpouList(),
      getFopRequisites(),
      getServiceNames(),
      getAnnualPaidMonths(),
    ]);
  return {
    patterns,
    smsKeywords,
    transitEdrpouList,
    fopRequisites,
    serviceNames,
    annualPaidMonths,
  };
}

type ClassificationSettings = Awaited<ReturnType<typeof loadClassificationSettings>>;

async function classifyPaymentInTx(
  tx: Tx,
  paymentId: string,
  forcedClientId: string | undefined,
  settings: ClassificationSettings,
) {
  const data = await fetchClassificationData(tx, paymentId);
  if (data.alreadyFinal) {
    // Idempotent no-op: a prior run (or a manual skip) already finalised this
    // payment. Don't classify, don't touch the row — the FOR UPDATE lock has
    // already served its purpose (no duplicate act).
    logger.info(
      { event: "classification.noop", paymentId, status: data.status },
      "payment already final; classification skipped",
    );
    return null;
  }
  const { payment, clientsWithContracts, allTariffs, allSmsPrices } = data;

  const forcedClient = forcedClientId
    ? clientsWithContracts.find((c) => c.id === forcedClientId)
    : undefined;
  if (forcedClientId && !forcedClient) {
    throw new Error(`Client ${forcedClientId} not found`);
  }

  const classResult = classify({
    payment,
    clients: clientsWithContracts,
    patterns: settings.patterns,
    smsKeywords: settings.smsKeywords,
    transitEdrpouList: settings.transitEdrpouList,
    tariffs: allTariffs,
    smsPrices: allSmsPrices,
    serviceNames: settings.serviceNames,
    annualPaidMonths: settings.annualPaidMonths,
    existingActCount: 0,
    ...(forcedClient ? { forcedClient } : {}),
  });

  if (classResult.status === "classified") {
    const actId = await finalizeClassifiedAct(tx, paymentId, classResult, settings.fopRequisites);
    return { classResult, actId };
  }

  await writeQueueResult(tx, paymentId, classResult);
  return { classResult, actId: null };
}

/**
 * Runs the classification pipeline for a payment inside a single `FOR UPDATE`
 * transaction. Returns `null` when the payment was already in a terminal state
 * (`classified` or `skipped`) at the moment the lock was acquired — i.e. a
 * concurrent or redundant trigger that did nothing. Callers SHOULD treat `null`
 * as a successful no-op (no act was created or modified).
 */
export async function runClassification(
  paymentId: string,
  forcedClientId?: string,
): Promise<ClassificationResult | null> {
  const settings = await loadClassificationSettings();
  const result = await dbPool.transaction((tx) =>
    classifyPaymentInTx(tx, paymentId, forcedClientId, settings),
  );

  if (result === null) return null; // no-op: payment was already terminal

  if (result.actId) {
    generateAndStoreActPdf(result.actId).catch(() => {});
  }

  return result.classResult;
}

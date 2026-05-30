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
import { manualActDate, manualBankTransactionId } from "./manual-act-id";
import { nextActNumber } from "./numbering";

/** Fixed note recorded on the backing manual payment's `purpose`. */
const MANUAL_PURPOSE = "Ручне створення акту (платіж не через ПриватБанк)";

export interface CreateManualActInput {
  client: Client;
  contract: Contract;
  /** 1-12. */
  periodMonth: number;
  periodYear: number;
  serviceType: ServiceType;
  unitPrice: string;
  quantity: string;
  /** Authoritative paid total, stored verbatim (D4). */
  amount: string;
  /** Originating bank for the other-bank case; null when unknown. */
  bankLabel: string | null;
  /** Explicit payment date; defaults to the period end when null (D3). */
  paymentDate: string | null;
}

export interface CreateManualActResult {
  actId: string;
  paymentId: string;
}

/**
 * Create a manual act and its backing manual payment in one transaction, then
 * fire PDF generation + DubiDoc send after commit. Reuses the auto path's
 * building blocks (`buildManualActStub`, `nextActNumber`, FOP snapshot) but takes
 * service/quantity/amount/period from admin input instead of deriving them from
 * the payment. The payment is left `classified` + linked to the act, mirroring
 * the state automatic classification produces, so the act-always-has-a-payment
 * invariant holds.
 */
export async function createManualAct(input: CreateManualActInput): Promise<CreateManualActResult> {
  const [serviceNames, fopSnapshot] = await Promise.all([getServiceNames(), getFopRequisites()]);

  const actDate = manualActDate(input.periodYear, input.periodMonth);
  const paymentDate = input.paymentDate ?? actDate;
  const bankTransactionId = manualBankTransactionId();

  const result = await dbPool.transaction(async (tx) => {
    const [payment] = await tx
      .insert(schema.payments)
      .values({
        bankTransactionId,
        paymentDate,
        amount: input.amount,
        purpose: MANUAL_PURPOSE,
        payerName: input.client.name,
        payerLegalId: input.client.legalId,
        payerBankAccount: input.client.bankAccount,
        rawData: {},
        source: "manual_external",
        bankLabel: input.bankLabel,
        status: "received",
      })
      .returning({ id: schema.payments.id });

    const paymentId = payment!.id;

    const stub = buildManualActStub({
      client: input.client,
      contract: input.contract,
      paymentId,
      serviceType: input.serviceType,
      unitPrice: input.unitPrice,
      quantity: input.quantity,
      amount: input.amount,
      actDate,
      serviceNames,
    });
    stub.number = await nextActNumber(tx, input.client.id, actDate);
    stub.fopSnapshot = fopSnapshot;

    const [newAct] = await tx.insert(schema.acts).values(stub).returning({ id: schema.acts.id });
    const actId = newAct!.id;

    await tx
      .update(schema.payments)
      .set({
        status: "classified",
        clientId: input.client.id,
        serviceType: input.serviceType,
        unitPrice: input.unitPrice,
        quantity: input.quantity,
        quantityUnit: stub.quantityUnit,
        actId,
        updatedAt: sql`now()`,
      })
      .where(eq(schema.payments.id, paymentId));

    return { actId, paymentId };
  });

  logger.info(
    { event: "manual_act.created", actId: result.actId, paymentId: result.paymentId },
    "manual act created",
  );

  // Mirror the PDF route / act page: generate the PDF, then auto-send to DubiDoc
  // for dubidoc clients. Fire-and-forget — a failure leaves the act `draft` with
  // `pdf_file_url = NULL`, recoverable via the act page's regenerate/resend.
  generateAndStoreActPdf(result.actId)
    .then(() =>
      input.client.edoProvider === "dubidoc" ? sendActToDubidoc(result.actId) : undefined,
    )
    .catch((err: unknown) => {
      const message = err instanceof Error ? err.message : "Unknown";
      logger.warn(
        { event: "manual_act.pdf_send_error", actId: result.actId, error: message },
        "manual act pdf/send failed",
      );
    });

  return result;
}

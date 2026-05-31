import { eq, sql } from "drizzle-orm";

import type { ServiceType } from "@/lib/classification/types";
import { dbPool, schema } from "@/lib/db";
import { sendActToDubidoc } from "@/lib/edo/send-to-dubidoc";
import { logger } from "@/lib/logging";

import { isEditableManualAct } from "./manual-act-eligibility";
import { generateAndStoreActPdf } from "./generate-pdf";

export interface UpdateManualActInput {
  serviceType: ServiceType;
  unitPrice: string;
  quantity: string;
  /** Authoritative paid total, stored verbatim (D4). */
  amount: string;
  /** Originating bank; null clears it. */
  bankLabel: string | null;
  /** Explicit payment date; defaults to the act's period end when null. */
  paymentDate: string | null;
}

/**
 * Update a manual act's value fields and its backing payment together in one
 * transaction, then regenerate the PDF (re-sending to DubiDoc for the still-`draft`
 * dubidoc case, mirroring `regeneratePdfAction`).
 *
 * Eligibility is re-validated *inside* the transaction against the joined
 * `payments.source` so a non-manual or already-sent act can never be edited even
 * if the action-layer guard is bypassed. The act number, client and period are
 * left untouched — only `serviceType`, `unitPrice`, `quantity`, `amount` move on
 * the act, kept in sync with the backing payment's mirror columns.
 *
 * The `serviceDescription` is intentionally NOT rebuilt when `serviceType`
 * changes: it stays separately editable via `updateServiceDescriptionAction`, so
 * silently overwriting an admin's custom wording here would be surprising.
 */
export async function updateManualAct(actId: string, input: UpdateManualActInput): Promise<void> {
  const edoProvider = await dbPool.transaction(async (tx) => {
    const [row] = await tx
      .select({
        paymentId: schema.acts.paymentId,
        status: schema.acts.status,
        edoProvider: schema.acts.edoProvider,
        actDate: schema.acts.actDate,
        source: schema.payments.source,
      })
      .from(schema.acts)
      .innerJoin(schema.payments, eq(schema.acts.paymentId, schema.payments.id))
      .where(eq(schema.acts.id, actId))
      .limit(1);

    if (!row) throw new Error("Акт не знайдено");
    if (!isEditableManualAct(row)) {
      throw new Error("Редагувати можна лише ручний акт, який ще не відправлено в ЕДО");
    }

    const paymentDate = input.paymentDate ?? row.actDate;

    await tx
      .update(schema.acts)
      .set({
        serviceType: input.serviceType,
        unitPrice: input.unitPrice,
        quantity: input.quantity,
        amount: input.amount,
        updatedAt: sql`now()`,
      })
      .where(eq(schema.acts.id, actId));

    await tx
      .update(schema.payments)
      .set({
        amount: input.amount,
        serviceType: input.serviceType,
        unitPrice: input.unitPrice,
        quantity: input.quantity,
        paymentDate,
        bankLabel: input.bankLabel,
        updatedAt: sql`now()`,
      })
      .where(eq(schema.payments.id, row.paymentId));

    return row.edoProvider;
  });

  logger.info({ event: "manual_act.updated", actId }, "manual act updated");

  // Mirror `regeneratePdfAction`: regenerate the PDF, then (for a still-`draft`
  // dubidoc act) re-send to DubiDoc fire-and-forget. Sent dubidoc acts are
  // excluded by the eligibility guard, so this never amends an external document.
  await generateAndStoreActPdf(actId);
  if (edoProvider === "dubidoc") {
    sendActToDubidoc(actId).catch(() => {});
  }
}

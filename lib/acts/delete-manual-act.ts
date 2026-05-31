import { eq } from "drizzle-orm";

import { dbPool, schema } from "@/lib/db";
import { logger } from "@/lib/logging";

import { isEditableManualAct } from "./manual-act-eligibility";

/**
 * Permanently delete a manual act and its synthetic backing payment in one
 * transaction. Eligibility is re-validated inside the tx against the joined
 * `payments.source`.
 *
 * Order matters: `payments.act_id` references `acts.id` (`onDelete: set null`),
 * so the act is deleted first (which nulls the back-reference) and then the
 * payment row is removed — leaving no orphaned `classified` payment. Hard delete
 * (not a `status` flip) frees the act number `MM/YYYY[/N]` for reuse and avoids
 * colliding with the `UNIQUE(client, act_date, number)` constraint and the
 * existing `status = 'deleted'` ("archived in DubiDoc") meaning.
 */
export async function deleteManualAct(actId: string): Promise<void> {
  await dbPool.transaction(async (tx) => {
    const [row] = await tx
      .select({
        paymentId: schema.acts.paymentId,
        status: schema.acts.status,
        edoProvider: schema.acts.edoProvider,
        source: schema.payments.source,
      })
      .from(schema.acts)
      .innerJoin(schema.payments, eq(schema.acts.paymentId, schema.payments.id))
      .where(eq(schema.acts.id, actId))
      .limit(1);

    if (!row) throw new Error("Акт не знайдено");
    if (!isEditableManualAct(row)) {
      throw new Error("Видалити можна лише ручний акт, який ще не відправлено в ЕДО");
    }

    await tx.delete(schema.acts).where(eq(schema.acts.id, actId));
    await tx.delete(schema.payments).where(eq(schema.payments.id, row.paymentId));
  });

  logger.info({ event: "manual_act.deleted", actId }, "manual act deleted");
}

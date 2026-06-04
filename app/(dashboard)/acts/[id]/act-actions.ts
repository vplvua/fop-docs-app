"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { deleteManualAct } from "@/lib/acts/delete-manual-act";
import { generateAndStoreActPdf } from "@/lib/acts/generate-pdf";
import { isEditableManualAct } from "@/lib/acts/manual-act-eligibility";
import { manualActEditSchema, type ManualActEditInput } from "@/lib/acts/manual-act-schema";
import { updateManualAct } from "@/lib/acts/update-manual-act";
import { db } from "@/lib/db";
import { acts } from "@/lib/db/schema/acts";
import { payments } from "@/lib/db/schema/payments";
import { mapDubidocStatus } from "@/lib/edo/dubidoc-status";
import { sendActToDubidoc } from "@/lib/edo/send-to-dubidoc";
import { validateVchasnoTransition } from "@/lib/edo/vchasno-state";
import { DubiDocApiError, getDocumentStatus } from "@/lib/external-apis/dubidoc";
import { logger } from "@/lib/logging";

export async function regeneratePdfAction(actId: string): Promise<{ ok: boolean; error?: string }> {
  const [act] = await db
    .select({ id: acts.id, edoProvider: acts.edoProvider })
    .from(acts)
    .where(eq(acts.id, actId))
    .limit(1);
  if (!act) return { ok: false, error: "Акт не знайдено" };

  try {
    await generateAndStoreActPdf(actId);
    if (act.edoProvider === "dubidoc") {
      sendActToDubidoc(actId).catch(() => {});
    }
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Невідома помилка";
    return { ok: false, error: `Помилка генерації PDF: ${msg}` };
  }
}

export async function updateServiceDescriptionAction(
  actId: string,
  description: string,
): Promise<{ ok: boolean; error?: string }> {
  const [act] = await db
    .select({ status: acts.status, edoProvider: acts.edoProvider })
    .from(acts)
    .where(eq(acts.id, actId))
    .limit(1);

  if (!act) return { ok: false, error: "Акт не знайдено" };

  const canEdit = act.status === "draft" || act.edoProvider === "vchasno_external";
  if (!canEdit) {
    return { ok: false, error: "Редагування заблоковано для цього статусу" };
  }

  await db
    .update(acts)
    .set({ serviceDescription: description, updatedAt: sql`now()` })
    .where(eq(acts.id, actId));

  generateAndStoreActPdf(actId).catch(() => {});

  return { ok: true };
}

/**
 * Load an act with its backing payment `source` to decide whether it is an
 * editable manual act. Shared guard for the edit/delete actions below.
 */
async function loadManualActGuard(actId: string) {
  const [row] = await db
    .select({
      status: acts.status,
      edoProvider: acts.edoProvider,
      source: payments.source,
    })
    .from(acts)
    .innerJoin(payments, eq(acts.paymentId, payments.id))
    .where(eq(acts.id, actId))
    .limit(1);
  return row;
}

export async function updateManualActAction(
  actId: string,
  input: ManualActEditInput,
): Promise<{ ok: boolean; error?: string }> {
  const row = await loadManualActGuard(actId);
  if (!row) return { ok: false, error: "Акт не знайдено" };
  if (!isEditableManualAct(row)) {
    return { ok: false, error: "Редагувати можна лише ручний акт, який ще не відправлено в ЕДО" };
  }

  const parsed = manualActEditSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Перевірте поля форми" };

  try {
    await updateManualAct(actId, parsed.data);
    revalidatePath(`/acts/${actId}`);
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Невідома помилка";
    logger.error(
      { event: "manual_act.update_action_error", actId, error: message },
      "update failed",
    );
    return { ok: false, error: `Не вдалося оновити акт: ${message}` };
  }
}

export async function deleteManualActAction(
  actId: string,
): Promise<{ ok: boolean; error?: string }> {
  const row = await loadManualActGuard(actId);
  if (!row) return { ok: false, error: "Акт не знайдено" };
  if (!isEditableManualAct(row)) {
    return { ok: false, error: "Видалити можна лише ручний акт, який ще не відправлено в ЕДО" };
  }

  try {
    await deleteManualAct(actId);
    revalidatePath("/acts");
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Невідома помилка";
    logger.error(
      { event: "manual_act.delete_action_error", actId, error: message },
      "delete failed",
    );
    return { ok: false, error: `Не вдалося видалити акт: ${message}` };
  }
}

export async function markActSignedAction(actId: string): Promise<{ ok: boolean; error?: string }> {
  const [act] = await db
    .select({ status: acts.status, edoProvider: acts.edoProvider })
    .from(acts)
    .where(eq(acts.id, actId))
    .limit(1);

  if (!act) return { ok: false, error: "Акт не знайдено" };

  const validation = validateVchasnoTransition(act.status, "signed", act.edoProvider);
  if (!validation.ok) return { ok: false, error: validation.error };

  await db
    .update(acts)
    .set({ status: "signed", updatedAt: sql`now()` })
    .where(eq(acts.id, actId));

  return { ok: true };
}

export async function unmarkActSignedAction(
  actId: string,
): Promise<{ ok: boolean; error?: string }> {
  const [act] = await db
    .select({ status: acts.status, edoProvider: acts.edoProvider })
    .from(acts)
    .where(eq(acts.id, actId))
    .limit(1);

  if (!act) return { ok: false, error: "Акт не знайдено" };

  const validation = validateVchasnoTransition(act.status, "draft", act.edoProvider);
  if (!validation.ok) return { ok: false, error: validation.error };

  await db
    .update(acts)
    .set({ status: "draft", updatedAt: sql`now()` })
    .where(eq(acts.id, actId));

  return { ok: true };
}

export async function retryDubidocSendAction(
  actId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const result = await sendActToDubidoc(actId);
    if (result.skipped) return { ok: true };
    if (result.sent) return { ok: true };
    return { ok: false, error: result.error ?? "Не вдалося відправити" };
  } catch {
    return { ok: false, error: "Помилка відправки в Дубідок" };
  }
}

export async function refreshDubidocStatusAction(
  actId: string,
): Promise<{ ok: boolean; error?: string }> {
  const [act] = await db
    .select({ edoDocId: acts.edoDocId, status: acts.status, edoProvider: acts.edoProvider })
    .from(acts)
    .where(eq(acts.id, actId))
    .limit(1);

  if (!act) return { ok: false, error: "Акт не знайдено" };
  if (act.edoProvider !== "dubidoc") return { ok: false, error: "Акт не є Дубідок" };
  if (!act.edoDocId) return { ok: false, error: "Акт ще не відправлено" };

  try {
    const response = await getDocumentStatus(act.edoDocId);
    const patch = mapDubidocStatus(response);

    await db
      .update(acts)
      .set({
        ...(patch.status ? { status: patch.status } : {}),
        edoStatus: patch.edoStatus,
        updatedAt: sql`now()`,
      })
      .where(eq(acts.id, actId));

    return { ok: true };
  } catch (err) {
    if (err instanceof DubiDocApiError && err.statusCode === 404) {
      await db
        .update(acts)
        .set({
          status: "draft",
          edoDocId: null,
          edoStatus: null,
          sentToEdoAt: null,
          updatedAt: sql`now()`,
        })
        .where(eq(acts.id, actId));
      return { ok: true };
    }
    return { ok: false, error: "Помилка оновлення статусу з Дубідок" };
  }
}

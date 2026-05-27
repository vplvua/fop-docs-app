"use server";

import { eq, sql } from "drizzle-orm";

import { generateAndStoreActPdf } from "@/lib/acts/generate-pdf";
import { db } from "@/lib/db";
import { acts } from "@/lib/db/schema/acts";
import { sendActToDubidoc } from "@/lib/edo/send-to-dubidoc";
import { validateVchasnoTransition } from "@/lib/edo/vchasno-state";
import { getDocumentStatus } from "@/lib/external-apis/dubidoc";

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

    const updates: Record<string, unknown> = { edoStatus: response.status, updatedAt: sql`now()` };

    if (response.status === "signed") {
      updates.status = "signed";
    } else if (response.archived) {
      updates.status = "deleted";
      updates.edoStatus = "archived";
    } else if (response.refused) {
      updates.edoStatus = "refused";
    }

    await db.update(acts).set(updates).where(eq(acts.id, actId));

    return { ok: true };
  } catch {
    return { ok: false, error: "Помилка оновлення статусу з Дубідок" };
  }
}

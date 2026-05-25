"use server";

import { eq, sql } from "drizzle-orm";

import { triggerPdfGeneration } from "@/lib/acts/generate-pdf";
import { db } from "@/lib/db";
import { acts } from "@/lib/db/schema/acts";

export async function regeneratePdfAction(actId: string): Promise<{ ok: boolean; error?: string }> {
  const [act] = await db.select({ id: acts.id }).from(acts).where(eq(acts.id, actId)).limit(1);
  if (!act) return { ok: false, error: "Акт не знайдено" };

  try {
    await triggerPdfGeneration(actId);
    return { ok: true };
  } catch {
    return { ok: false, error: "Помилка генерації PDF" };
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

  triggerPdfGeneration(actId).catch(() => {});

  return { ok: true };
}

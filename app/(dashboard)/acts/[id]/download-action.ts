"use server";

import { eq } from "drizzle-orm";

import { getActPdfDownloadUrl } from "@/lib/blob";
import { db } from "@/lib/db";
import { acts } from "@/lib/db/schema/acts";

export async function getDownloadUrlAction(
  actId: string,
): Promise<{ ok: boolean; url?: string; error?: string }> {
  const [act] = await db
    .select({ pdfFileUrl: acts.pdfFileUrl })
    .from(acts)
    .where(eq(acts.id, actId))
    .limit(1);

  if (!act) return { ok: false, error: "Акт не знайдено" };
  if (!act.pdfFileUrl) return { ok: false, error: "PDF ще не згенеровано" };

  try {
    const url = await getActPdfDownloadUrl(act.pdfFileUrl);
    return { ok: true, url };
  } catch {
    return { ok: false, error: "Помилка отримання URL" };
  }
}

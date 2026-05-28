"use server";

import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { acts } from "@/lib/db/schema/acts";

export async function getDownloadUrlAction(
  actId: string,
): Promise<{ ok: boolean; url?: string; error?: string }> {
  const [act] = await db.select({ id: acts.id }).from(acts).where(eq(acts.id, actId)).limit(1);

  if (!act) return { ok: false, error: "Акт не знайдено" };

  return { ok: true, url: `/api/acts/${actId}/pdf` };
}

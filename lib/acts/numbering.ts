import { and, eq } from "drizzle-orm";

import { acts } from "@/lib/db/schema/acts";

type Tx = {
  select: typeof import("@/lib/db").dbPool.select;
};

/** Month (1-12) parsed directly from a "YYYY-MM-DD" string (no timezone math). */
export function extractMonth(dateStr: string): number {
  return Number(dateStr.split("-")[1]);
}

/** Year parsed directly from a "YYYY-MM-DD" string. */
export function extractYear(dateStr: string): number {
  return Number(dateStr.split("-")[0]);
}

/**
 * Act number `MM/YYYY` for the first act of a client in a month, `MM/YYYY/N`
 * for the Nth subsequent one (N = existingCount + 1). Month is zero-padded.
 */
export function formatActNumber(month: number, year: number, existingCount: number): string {
  const base = `${String(month).padStart(2, "0")}/${year}`;
  return existingCount === 0 ? base : `${base}/${existingCount + 1}`;
}

export async function nextActNumber(tx: Tx, clientId: string, actDate: string): Promise<string> {
  const rows = await tx
    .select({ id: acts.id })
    .from(acts)
    .where(and(eq(acts.clientId, clientId), eq(acts.actDate, actDate)))
    .for("update");

  const count = rows.length;
  return formatActNumber(extractMonth(actDate), extractYear(actDate), count);
}

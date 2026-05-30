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

/**
 * Reformat an existing act number to the current `MM/YYYY[/N]` format, preserving
 * its per-client/month ordinal. Used by mass regeneration to migrate legacy
 * numbers (`№5` → `05/2026`, `№5/2` → `05/2026/2`). Numbers already in the new
 * format are normalised against `act_date` (idempotent). Unrecognised values are
 * returned unchanged.
 */
export function reformatActNumber(oldNumber: string, actDate: string): string {
  const month = extractMonth(actDate);
  const year = extractYear(actDate);

  // Legacy `№M` / `№M/N`.
  const legacy = oldNumber.match(/^№\d+(?:\/(\d+))?$/);
  if (legacy) {
    const ordinal = legacy[1] ? Number(legacy[1]) : 1;
    return formatActNumber(month, year, ordinal - 1);
  }

  // Current `MM/YYYY` / `MM/YYYY/N`.
  const current = oldNumber.match(/^\d{2}\/\d{4}(?:\/(\d+))?$/);
  if (current) {
    const ordinal = current[1] ? Number(current[1]) : 1;
    return formatActNumber(month, year, ordinal - 1);
  }

  return oldNumber;
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

import { and, eq, sql } from "drizzle-orm";

import { acts } from "@/lib/db/schema/acts";

type Tx = {
  select: typeof import("@/lib/db").dbPool.select;
};

export function extractMonth(dateStr: string): number {
  return new Date(dateStr).getMonth() + 1;
}

export function formatActNumber(month: number, existingCount: number): string {
  if (existingCount === 0) return `№${month}`;
  return `№${month}/${existingCount + 1}`;
}

export async function nextActNumber(tx: Tx, clientId: string, actDate: string): Promise<string> {
  const [row] = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(acts)
    .where(and(eq(acts.clientId, clientId), eq(acts.actDate, actDate)))
    .for("update");

  const count = row?.count ?? 0;
  const month = extractMonth(actDate);
  return formatActNumber(month, count);
}

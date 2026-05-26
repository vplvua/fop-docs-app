import { eq, sql } from "drizzle-orm";

import { uploadActPdf } from "@/lib/blob";
import { db } from "@/lib/db";
import { acts } from "@/lib/db/schema/acts";
import { logger } from "@/lib/logging";
import { renderActPdf } from "@/lib/pdf/render";

export async function generateAndStoreActPdf(actId: string): Promise<string> {
  const [act] = await db.select().from(acts).where(eq(acts.id, actId)).limit(1);
  if (!act) throw new Error("Act not found");

  const pdfBuffer = await renderActPdf(act);
  const blobUrl = await uploadActPdf(actId, pdfBuffer);

  await db
    .update(acts)
    .set({ pdfFileUrl: blobUrl, updatedAt: sql`now()` })
    .where(eq(acts.id, actId));

  logger.info({ event: "act.pdf_generated", actId }, "PDF generated");
  return blobUrl;
}

import { eq, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { type Act, acts } from "@/lib/db/schema/acts";
import { actToCreateDocumentPayload, createDocument } from "@/lib/external-apis/dubidoc";
import { logger } from "@/lib/logging";
import { recordIntegrationError, recordIntegrationSuccess } from "@/lib/observability";
import { renderActPdf } from "@/lib/pdf/render";

export interface SendResult {
  sent: boolean;
  skipped: boolean;
  error?: string;
}

function shouldSkip(act: Act): SendResult | null {
  if (act.edoProvider !== "dubidoc") return { sent: false, skipped: true };
  if (act.status !== "draft") return { sent: false, skipped: true };
  if (act.edoDocId) return { sent: false, skipped: true };
  return null;
}

export async function sendActToDubidoc(actId: string): Promise<SendResult> {
  const [act] = await db.select().from(acts).where(eq(acts.id, actId)).limit(1);
  if (!act) return { sent: false, skipped: true, error: "Act not found" };

  const skip = shouldSkip(act);
  if (skip) return skip;

  try {
    const pdfBuffer = await renderActPdf(act);
    const pdfBase64 = pdfBuffer.toString("base64");

    const payload = actToCreateDocumentPayload(act, pdfBase64);
    const response = await createDocument(payload);

    await db
      .update(acts)
      .set({
        status: "sent_to_edo",
        edoDocId: response.id,
        sentToEdoAt: sql`now()`,
        updatedAt: sql`now()`,
      })
      .where(eq(acts.id, actId));

    await recordIntegrationSuccess("dubidoc");
    logger.info(
      { event: "edo.sent_to_dubidoc", actId, edoDocId: response.id },
      "Act sent to DubiDoc",
    );

    return { sent: true, skipped: false };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    logger.error(
      { event: "edo.send_failed", actId, error: message },
      "Failed to send act to DubiDoc",
    );
    await recordIntegrationError("dubidoc", err);
    return { sent: false, skipped: false, error: message };
  }
}

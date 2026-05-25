import { logger } from "@/lib/logging";

export async function triggerPdfGeneration(actId: string): Promise<void> {
  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : `http://localhost:${process.env.PORT ?? "3000"}`;

  try {
    const res = await fetch(`${baseUrl}/api/acts/${actId}/pdf`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    if (!res.ok) {
      const body = await res.text();
      logger.warn(
        { event: "act.pdf_trigger_failed", actId, status: res.status, body },
        "PDF trigger failed",
      );
    } else {
      logger.info({ event: "act.pdf_triggered", actId }, "PDF generation triggered");
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown";
    logger.warn({ event: "act.pdf_trigger_error", actId, error: msg }, "PDF trigger error");
  }
}

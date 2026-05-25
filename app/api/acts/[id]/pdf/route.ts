import { eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { uploadActPdf } from "@/lib/blob";
import { db } from "@/lib/db";
import { acts } from "@/lib/db/schema/acts";
import { sendActToDubidoc } from "@/lib/edo/send-to-dubidoc";
import { logger } from "@/lib/logging";
import { renderActPdf } from "@/lib/pdf/render";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(_request: Request, { params }: RouteParams) {
  const { id } = await params;

  const [act] = await db.select().from(acts).where(eq(acts.id, id)).limit(1);
  if (!act) {
    return NextResponse.json({ error: "Act not found" }, { status: 404 });
  }

  try {
    const pdfBuffer = await renderActPdf(act);
    const blobUrl = await uploadActPdf(id, pdfBuffer);

    await db
      .update(acts)
      .set({ pdfFileUrl: blobUrl, updatedAt: sql`now()` })
      .where(eq(acts.id, id));

    logger.info({ event: "act.pdf_generated", actId: id }, "PDF generated");

    if (act.edoProvider === "dubidoc") {
      sendActToDubidoc(id).catch(() => {});
    }

    return NextResponse.json({ ok: true, pdfFileUrl: blobUrl });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    logger.error({ event: "act.pdf_error", actId: id, error: msg }, "PDF generation failed");
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

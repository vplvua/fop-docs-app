import { NextResponse } from "next/server";

import { generateAndStoreActPdf } from "@/lib/acts/generate-pdf";
import { db } from "@/lib/db";
import { acts } from "@/lib/db/schema/acts";
import { sendActToDubidoc } from "@/lib/edo/send-to-dubidoc";
import { logger } from "@/lib/logging";
import { eq } from "drizzle-orm";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(_request: Request, { params }: RouteParams) {
  const { id } = await params;

  const [act] = await db
    .select({ id: acts.id, edoProvider: acts.edoProvider })
    .from(acts)
    .where(eq(acts.id, id))
    .limit(1);
  if (!act) {
    return NextResponse.json({ error: "Act not found" }, { status: 404 });
  }

  try {
    const pdfFileUrl = await generateAndStoreActPdf(id);

    if (act.edoProvider === "dubidoc") {
      sendActToDubidoc(id).catch(() => {});
    }

    return NextResponse.json({ ok: true, pdfFileUrl });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    logger.error({ event: "act.pdf_error", actId: id, error: msg }, "PDF generation failed");
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

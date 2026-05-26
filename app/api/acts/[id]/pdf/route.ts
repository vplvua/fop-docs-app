import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { generateAndStoreActPdf } from "@/lib/acts/generate-pdf";
import { db } from "@/lib/db";
import { acts } from "@/lib/db/schema/acts";
import { logger } from "@/lib/logging";
import { renderActPdf } from "@/lib/pdf/render";
import { sendActToDubidoc } from "@/lib/edo/send-to-dubidoc";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { id } = await params;

  const [act] = await db.select().from(acts).where(eq(acts.id, id)).limit(1);
  if (!act) {
    return NextResponse.json({ error: "Act not found" }, { status: 404 });
  }

  try {
    const pdfBuffer = await renderActPdf(act);
    const filename = `act-${act.number}-${act.actDate}.pdf`;

    return new Response(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    logger.error({ event: "act.pdf_download_error", actId: id, error: msg }, "PDF download failed");
    return NextResponse.json({ error: msg }, { status: 500 });
  }
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
    await generateAndStoreActPdf(id);

    if (act.edoProvider === "dubidoc") {
      sendActToDubidoc(id).catch(() => {});
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    logger.error({ event: "act.pdf_error", actId: id, error: msg }, "PDF generation failed");
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

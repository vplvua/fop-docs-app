import { createElement } from "react";

import { renderToBuffer } from "@react-pdf/renderer";

import type { Act } from "@/lib/db/schema/acts";
import { getFopRequisites, type FopRequisites } from "@/lib/requisites";
import { fopRequisitesSchema } from "@/lib/requisites/schema";

import { ActTemplate } from "./act-template";

/**
 * Executor requisites for the act PDF. Prefers the act's immutable
 * `fop_snapshot`; falls back to live requisites only for legacy acts created
 * before snapshots existed. Throws when neither is available, so the act stays
 * `draft` and can be regenerated once requisites are configured.
 */
async function resolveFopDetails(act: Act): Promise<FopRequisites> {
  if (act.fopSnapshot != null) {
    return fopRequisitesSchema.parse(act.fopSnapshot);
  }
  const live = await getFopRequisites();
  if (live == null) {
    throw new Error(
      `Cannot render act ${act.id}: no fop_snapshot and FOP requisites are not configured`,
    );
  }
  return live;
}

export async function renderActPdf(act: Act): Promise<Buffer> {
  const fop = await resolveFopDetails(act);
  const doc = createElement(ActTemplate, {
    act,
    fop,
  });
  // renderToBuffer expects ReactElement<DocumentProps> but our wrapper component returns <Document> inside
  const buffer = await renderToBuffer(doc as Parameters<typeof renderToBuffer>[0]);
  return Buffer.from(buffer);
}

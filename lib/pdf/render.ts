import { createElement } from "react";

import { renderToBuffer } from "@react-pdf/renderer";

import type { Act } from "@/lib/db/schema/acts";

import { ActTemplate } from "./act-template";

function getFopDetails() {
  return {
    name: process.env.FOP_NAME ?? "ФОП Не вказано",
    legalId: process.env.FOP_LEGAL_ID ?? "",
    address: process.env.FOP_ADDRESS ?? "",
    bankAccount: process.env.FOP_BANK_ACCOUNT ?? "",
    bankName: process.env.FOP_BANK_NAME ?? "",
  };
}

export async function renderActPdf(act: Act): Promise<Buffer> {
  const fop = getFopDetails();
  const doc = createElement(ActTemplate, {
    act,
    fop,
  });
  // renderToBuffer expects ReactElement<DocumentProps> but our wrapper component returns <Document> inside
  const buffer = await renderToBuffer(doc as Parameters<typeof renderToBuffer>[0]);
  return Buffer.from(buffer);
}

import type { Act } from "@/lib/db/schema/acts";

import type { CreateDocumentRequest } from "./types";

interface ActClientSnapshot {
  email: string;
  legalId: string;
}

export function actToCreateDocumentPayload(act: Act, pdfBase64: string): CreateDocumentRequest {
  const snapshot = act.clientSnapshot as ActClientSnapshot;
  const amount = Math.round(Number(act.unitPrice) * Number(act.quantity));

  return {
    file: pdfBase64,
    filename: `act_${act.number}_${act.actDate}.pdf`,
    title: `Акт ${act.number} від ${act.actDate}`,
    date: act.actDate,
    number: act.number,
    amount,
    signatureType: "external",
    workflowType: "sequential",
    participants: [
      {
        action: "sign",
        email: snapshot.email,
        edrpou: snapshot.legalId,
        priority: 1,
        isSignatureRequired: true,
      },
    ],
  };
}

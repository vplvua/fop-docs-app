import { describe, expect, it } from "vitest";

import { actToCreateDocumentPayload } from "@/lib/external-apis/dubidoc/mapper";
import type { Act } from "@/lib/db/schema/acts";

function makeAct(overrides: Partial<Act> = {}): Act {
  return {
    id: "act-001",
    clientId: "client-001",
    paymentId: "payment-001",
    status: "draft",
    serviceType: "access",
    unitPrice: "200.00",
    quantity: "3",
    quantityUnit: "міс.",
    actDate: "2026-04-30",
    number: "№4",
    clientSnapshot: {
      name: "ОСББ Тест",
      legalId: "12345678",
      address: "вул. Тестова, 1",
      bankName: "ПриватБанк",
      bankAccount: "UA1234567890",
      email: "test@example.com",
    },
    contractSnapshot: { number: "556770", signedDate: "2025-01-01" },
    serviceDescription: "Доступ до сервісу за період 3 міс.",
    edoProvider: "dubidoc",
    pdfFileUrl: "https://blob.vercel-storage.com/acts/act-001.pdf",
    edoDocId: null,
    edoStatus: null,
    sentToEdoAt: null,
    createdAt: new Date("2026-04-30T10:00:00Z"),
    updatedAt: new Date("2026-04-30T10:00:00Z"),
    ...overrides,
  };
}

describe("actToCreateDocumentPayload", () => {
  it("assembles correct payload with base64 file", () => {
    const act = makeAct();
    const pdfBase64 = "JVBER...base64content";

    const payload = actToCreateDocumentPayload(act, pdfBase64);

    expect(payload.file).toBe(pdfBase64);
    expect(payload.signatureType).toBe("external");
    expect(payload.workflowType).toBe("sequential");
  });

  it("uses act date and number in metadata", () => {
    const act = makeAct({ actDate: "2026-05-31", number: "№5/2" });
    const payload = actToCreateDocumentPayload(act, "base64");

    expect(payload.date).toBe("2026-05-31");
    expect(payload.number).toBe("№5/2");
    expect(payload.title).toBe("Акт №5/2 від 2026-05-31");
    expect(payload.filename).toBe("act_№5/2_2026-05-31.pdf");
  });

  it("calculates amount as integer from unitPrice × quantity", () => {
    const act = makeAct({ unitPrice: "200.00", quantity: "3" });
    const payload = actToCreateDocumentPayload(act, "base64");

    expect(payload.amount).toBe(600);
  });

  it("rounds amount to integer for fractional results", () => {
    const act = makeAct({ unitPrice: "1.40", quantity: "100" });
    const payload = actToCreateDocumentPayload(act, "base64");

    expect(payload.amount).toBe(140);
  });

  it("builds participants from client snapshot", () => {
    const act = makeAct({
      clientSnapshot: {
        name: "ОСББ Сонце",
        legalId: "87654321",
        address: "вул. Сонячна, 5",
        bankName: null,
        bankAccount: null,
        email: "sun@example.com",
      },
    });
    const payload = actToCreateDocumentPayload(act, "base64");

    expect(payload.participants).toHaveLength(1);
    expect(payload.participants[0]).toEqual({
      action: "sign",
      email: "sun@example.com",
      edrpou: "87654321",
      priority: 1,
      isSignatureRequired: true,
    });
  });
});

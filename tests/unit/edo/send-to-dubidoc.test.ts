import { beforeEach, describe, expect, it, vi } from "vitest";

const mockDbResult = { rows: [] as unknown[] };

vi.mock("@/lib/db", () => {
  const chain = {
    select: vi.fn(),
    from: vi.fn(),
    where: vi.fn(),
    limit: vi.fn(),
    update: vi.fn(),
    set: vi.fn(),
  };
  for (const fn of Object.values(chain)) {
    fn.mockImplementation(() => chain);
  }
  chain.limit.mockImplementation(() => mockDbResult.rows);
  chain.where.mockImplementation(() => chain);
  return { db: chain };
});

vi.mock("@/lib/external-apis/dubidoc", () => ({
  createDocument: vi.fn(),
  actToCreateDocumentPayload: vi.fn(),
}));

vi.mock("@/lib/observability", () => ({
  recordIntegrationSuccess: vi.fn(),
  recordIntegrationError: vi.fn(),
}));

vi.mock("@/lib/pdf/render", () => ({
  renderActPdf: vi.fn().mockResolvedValue(Buffer.from("fake-pdf")),
}));

import { actToCreateDocumentPayload, createDocument } from "@/lib/external-apis/dubidoc";
import { recordIntegrationError, recordIntegrationSuccess } from "@/lib/observability";
import { sendActToDubidoc } from "@/lib/edo/send-to-dubidoc";

const mockCreateDocument = vi.mocked(createDocument);
const mockMapper = vi.mocked(actToCreateDocumentPayload);
const mockRecordSuccess = vi.mocked(recordIntegrationSuccess);
const mockRecordError = vi.mocked(recordIntegrationError);

function makeAct(overrides = {}) {
  return {
    id: "act-001",
    clientId: "client-001",
    paymentId: "payment-001",
    status: "draft",
    edoProvider: "dubidoc",
    edoDocId: null,
    pdfFileUrl: "generated",
    clientSnapshot: {
      name: "Test",
      legalId: "12345678",
      address: "Kyiv",
      email: "test@example.com",
      bankName: null,
      bankAccount: null,
    },
    contractSnapshot: { number: "100", signedDate: "2024-06-01" },
    fopSnapshot: null,
    actDate: "2024-06-30",
    number: "1",
    serviceDescription: "Test service",
    unitPrice: "10.00",
    quantity: "5.00",
    quantityUnit: "шт.",
    amount: "50.00",
    billingPeriod: "monthly",
    ...overrides,
  };
}

describe("sendActToDubidoc", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbResult.rows = [];
  });

  it("skips if act not found", async () => {
    mockDbResult.rows = [];
    const result = await sendActToDubidoc("nonexistent");
    expect(result.skipped).toBe(true);
    expect(result.sent).toBe(false);
  });

  it("skips if edo_provider is not dubidoc", async () => {
    mockDbResult.rows = [makeAct({ edoProvider: "vchasno_external" })];
    const result = await sendActToDubidoc("act-001");
    expect(result.skipped).toBe(true);
  });

  it("skips if status is not draft", async () => {
    mockDbResult.rows = [makeAct({ status: "sent_to_edo" })];
    const result = await sendActToDubidoc("act-001");
    expect(result.skipped).toBe(true);
  });

  it("skips if edo_doc_id already set (idempotency)", async () => {
    mockDbResult.rows = [makeAct({ edoDocId: "already-sent" })];
    const result = await sendActToDubidoc("act-001");
    expect(result.skipped).toBe(true);
    expect(mockCreateDocument).not.toHaveBeenCalled();
  });

  it("sends to DubiDoc on success path", async () => {
    mockDbResult.rows = [makeAct()];
    mockMapper.mockReturnValueOnce({ file: "base64" } as never);
    mockCreateDocument.mockResolvedValueOnce({ id: "doc-999", status: "new" });

    const result = await sendActToDubidoc("act-001");
    expect(result.sent).toBe(true);
    expect(result.skipped).toBe(false);
    expect(mockCreateDocument).toHaveBeenCalled();
    expect(mockRecordSuccess).toHaveBeenCalledWith("dubidoc");
  });

  it("returns error on DubiDoc failure", async () => {
    mockDbResult.rows = [makeAct()];
    mockMapper.mockReturnValueOnce({ file: "base64" } as never);
    mockCreateDocument.mockRejectedValueOnce(new Error("DubiDoc down"));

    const result = await sendActToDubidoc("act-001");
    expect(result.sent).toBe(false);
    expect(result.skipped).toBe(false);
    expect(result.error).toBe("DubiDoc down");
    expect(mockRecordError).toHaveBeenCalledWith("dubidoc", expect.any(Error));
  });
});

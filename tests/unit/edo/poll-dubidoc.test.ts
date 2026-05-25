import { beforeEach, describe, expect, it, vi } from "vitest";

const mockQueryResult = { rows: [] as unknown[] };

vi.mock("@/lib/db", () => {
  const chain = {
    select: vi.fn(),
    from: vi.fn(),
    where: vi.fn(),
    update: vi.fn(),
    set: vi.fn(),
  };
  for (const fn of Object.values(chain)) {
    fn.mockImplementation(() => chain);
  }
  chain.where.mockImplementation(() => mockQueryResult.rows);
  return { db: chain };
});

vi.mock("@/lib/external-apis/dubidoc", () => ({
  getDocumentStatus: vi.fn(),
}));

vi.mock("@/lib/observability", () => ({
  recordIntegrationSuccess: vi.fn(),
  recordIntegrationError: vi.fn(),
}));

import { getDocumentStatus } from "@/lib/external-apis/dubidoc";
import { recordIntegrationSuccess, recordIntegrationError } from "@/lib/observability";
import { pollDubidocStatuses } from "@/lib/edo/poll-dubidoc";

const mockGetStatus = vi.mocked(getDocumentStatus);
const mockRecordSuccess = vi.mocked(recordIntegrationSuccess);
const mockRecordError = vi.mocked(recordIntegrationError);

describe("pollDubidocStatuses", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQueryResult.rows = [];
  });

  it("returns zeroes when no pending acts", async () => {
    mockQueryResult.rows = [];
    const result = await pollDubidocStatuses();
    expect(result.total).toBe(0);
    expect(mockGetStatus).not.toHaveBeenCalled();
  });

  it("maps signed status correctly", async () => {
    mockQueryResult.rows = [{ id: "act-1", edoDocId: "doc-1", paymentId: "pay-1" }];
    mockGetStatus.mockResolvedValueOnce({ id: "doc-1", status: "signed" });

    const result = await pollDubidocStatuses();
    expect(result.signed).toBe(1);
    expect(result.total).toBe(1);
    expect(mockRecordSuccess).toHaveBeenCalledWith("dubidoc");
  });

  it("maps archived status to deleted", async () => {
    mockQueryResult.rows = [{ id: "act-2", edoDocId: "doc-2", paymentId: "pay-2" }];
    mockGetStatus.mockResolvedValueOnce({ id: "doc-2", status: "new", archived: true });

    const result = await pollDubidocStatuses();
    expect(result.deleted).toBe(1);
  });

  it("maps refused status", async () => {
    mockQueryResult.rows = [{ id: "act-3", edoDocId: "doc-3", paymentId: "pay-3" }];
    mockGetStatus.mockResolvedValueOnce({ id: "doc-3", status: "new", refused: true });

    const result = await pollDubidocStatuses();
    expect(result.refused).toBe(1);
  });

  it("maps intermediate status as unchanged", async () => {
    mockQueryResult.rows = [{ id: "act-4", edoDocId: "doc-4", paymentId: "pay-4" }];
    mockGetStatus.mockResolvedValueOnce({ id: "doc-4", status: "sent_for_sign" });

    const result = await pollDubidocStatuses();
    expect(result.unchanged).toBe(1);
  });

  it("counts errors when getDocumentStatus throws", async () => {
    mockQueryResult.rows = [{ id: "act-5", edoDocId: "doc-5", paymentId: "pay-5" }];
    mockGetStatus.mockRejectedValueOnce(new Error("Network error"));

    const result = await pollDubidocStatuses();
    expect(result.errors).toBe(1);
    expect(result.total).toBe(1);
    expect(mockRecordError).toHaveBeenCalled();
  });

  it("records integration success when some succeed", async () => {
    mockQueryResult.rows = [
      { id: "act-6", edoDocId: "doc-6", paymentId: "pay-6" },
      { id: "act-7", edoDocId: "doc-7", paymentId: "pay-7" },
    ];
    mockGetStatus.mockResolvedValueOnce({ id: "doc-6", status: "signed" });
    mockGetStatus.mockRejectedValueOnce(new Error("fail"));

    const result = await pollDubidocStatuses();
    expect(result.signed).toBe(1);
    expect(result.errors).toBe(1);
    expect(mockRecordSuccess).toHaveBeenCalled();
  });
});

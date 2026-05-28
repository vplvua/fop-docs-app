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

vi.mock("@/lib/acts/generate-pdf", () => ({
  triggerPdfGeneration: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/edo/send-to-dubidoc", () => ({
  sendActToDubidoc: vi.fn(),
}));

vi.mock("@/lib/external-apis/dubidoc", () => ({
  getDocumentStatus: vi.fn(),
}));

vi.mock("@/lib/edo/poll-dubidoc", () => ({
  pollDubidocStatuses: vi.fn(),
}));

import { sendActToDubidoc } from "@/lib/edo/send-to-dubidoc";
import { getDocumentStatus } from "@/lib/external-apis/dubidoc";
import {
  retryDubidocSendAction,
  refreshDubidocStatusAction,
} from "@/app/(dashboard)/acts/[id]/act-actions";
import { triggerDubidocPollAction } from "@/app/(dashboard)/dashboard-actions";
import { pollDubidocStatuses } from "@/lib/edo/poll-dubidoc";

const mockSend = vi.mocked(sendActToDubidoc);
const mockGetStatus = vi.mocked(getDocumentStatus);
const mockPoll = vi.mocked(pollDubidocStatuses);

describe("retryDubidocSendAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbResult.rows = [];
  });

  it("returns ok on successful send", async () => {
    mockSend.mockResolvedValueOnce({ sent: true, skipped: false });
    const result = await retryDubidocSendAction("act-1");
    expect(result.ok).toBe(true);
  });

  it("returns ok when skipped", async () => {
    mockSend.mockResolvedValueOnce({ sent: false, skipped: true });
    const result = await retryDubidocSendAction("act-1");
    expect(result.ok).toBe(true);
  });

  it("returns error on failure", async () => {
    mockSend.mockResolvedValueOnce({ sent: false, skipped: false, error: "API down" });
    const result = await retryDubidocSendAction("act-1");
    expect(result.ok).toBe(false);
    expect(result.error).toBe("API down");
  });
});

describe("refreshDubidocStatusAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbResult.rows = [];
  });

  it("returns error when act not found", async () => {
    mockDbResult.rows = [];
    const result = await refreshDubidocStatusAction("nonexistent");
    expect(result.ok).toBe(false);
  });

  it("returns error for non-dubidoc act", async () => {
    mockDbResult.rows = [
      { edoDocId: "doc-1", status: "sent_to_edo", edoProvider: "vchasno_external" },
    ];
    const result = await refreshDubidocStatusAction("act-1");
    expect(result.ok).toBe(false);
  });

  it("returns ok on successful refresh", async () => {
    mockDbResult.rows = [{ edoDocId: "doc-1", status: "sent_to_edo", edoProvider: "dubidoc" }];
    mockGetStatus.mockResolvedValueOnce({ id: "doc-1", status: "signed" });

    const result = await refreshDubidocStatusAction("act-1");
    expect(result.ok).toBe(true);
  });
});

describe("triggerDubidocPollAction", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns ok with poll result", async () => {
    mockPoll.mockResolvedValueOnce({
      total: 5,
      signed: 2,
      deleted: 0,
      refused: 1,
      unchanged: 2,
      reset: 0,
      errors: 0,
    });
    const result = await triggerDubidocPollAction();
    expect(result.ok).toBe(true);
    expect(result.result?.signed).toBe(2);
  });

  it("returns error on failure", async () => {
    mockPoll.mockRejectedValueOnce(new Error("fail"));
    const result = await triggerDubidocPollAction();
    expect(result.ok).toBe(false);
    expect(result.error).toBeDefined();
  });
});

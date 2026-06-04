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
  generateSigningLink: vi.fn(),
  deleteSigningLinks: vi.fn(),
  sendDocument: vi.fn(),
}));

vi.mock("@/lib/edo/poll-dubidoc", () => ({
  pollDubidocStatuses: vi.fn(),
}));

import { sendActToDubidoc } from "@/lib/edo/send-to-dubidoc";
import {
  deleteSigningLinks,
  generateSigningLink,
  getDocumentStatus,
  sendDocument,
} from "@/lib/external-apis/dubidoc";
import {
  retryDubidocSendAction,
  refreshDubidocStatusAction,
  getSigningLinkAction,
  revokeSigningLinkAction,
  finalizeInAppSigningAction,
} from "@/app/(dashboard)/acts/[id]/act-actions";
import { triggerDubidocPollAction } from "@/app/(dashboard)/dashboard-actions";
import { pollDubidocStatuses } from "@/lib/edo/poll-dubidoc";

const mockSend = vi.mocked(sendActToDubidoc);
const mockGetStatus = vi.mocked(getDocumentStatus);
const mockGenerateLink = vi.mocked(generateSigningLink);
const mockDeleteLinks = vi.mocked(deleteSigningLinks);
const mockSendDocument = vi.mocked(sendDocument);
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

describe("getSigningLinkAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbResult.rows = [];
  });

  it("returns error when act not found", async () => {
    mockDbResult.rows = [];
    const result = await getSigningLinkAction("nonexistent");
    expect(result.ok).toBe(false);
    expect(mockGenerateLink).not.toHaveBeenCalled();
  });

  it("returns error for non-dubidoc act", async () => {
    mockDbResult.rows = [
      { edoDocId: "doc-1", status: "sent_to_edo", edoProvider: "vchasno_external" },
    ];
    const result = await getSigningLinkAction("act-1");
    expect(result.ok).toBe(false);
    expect(mockGenerateLink).not.toHaveBeenCalled();
  });

  it("returns error when status is not sent_to_edo", async () => {
    mockDbResult.rows = [
      { edoDocId: "doc-1", status: "waiting_for_client_sign", edoProvider: "dubidoc" },
    ];
    const result = await getSigningLinkAction("act-1");
    expect(result.ok).toBe(false);
    expect(mockGenerateLink).not.toHaveBeenCalled();
  });

  it("returns error when edoDocId is missing", async () => {
    mockDbResult.rows = [{ edoDocId: null, status: "sent_to_edo", edoProvider: "dubidoc" }];
    const result = await getSigningLinkAction("act-1");
    expect(result.ok).toBe(false);
    expect(mockGenerateLink).not.toHaveBeenCalled();
  });

  it("returns the signing url on success", async () => {
    mockDbResult.rows = [{ edoDocId: "doc-1", status: "sent_to_edo", edoProvider: "dubidoc" }];
    mockGenerateLink.mockResolvedValueOnce({ link: "https://my.dubidoc.com.ua/sign/abc" });

    const result = await getSigningLinkAction("act-1");
    expect(result.ok).toBe(true);
    expect(result.url).toBe("https://my.dubidoc.com.ua/sign/abc");
    expect(mockGenerateLink).toHaveBeenCalledWith("doc-1");
  });

  it("returns error when link generation throws", async () => {
    mockDbResult.rows = [{ edoDocId: "doc-1", status: "sent_to_edo", edoProvider: "dubidoc" }];
    mockGenerateLink.mockRejectedValueOnce(new Error("boom"));

    const result = await getSigningLinkAction("act-1");
    expect(result.ok).toBe(false);
  });
});

describe("revokeSigningLinkAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbResult.rows = [];
  });

  it("returns error when act not found", async () => {
    mockDbResult.rows = [];
    const result = await revokeSigningLinkAction("nonexistent");
    expect(result.ok).toBe(false);
    expect(mockDeleteLinks).not.toHaveBeenCalled();
  });

  it("no-ops (ok) for non-dubidoc act", async () => {
    mockDbResult.rows = [{ edoDocId: "doc-1", edoProvider: "vchasno_external" }];
    const result = await revokeSigningLinkAction("act-1");
    expect(result.ok).toBe(true);
    expect(mockDeleteLinks).not.toHaveBeenCalled();
  });

  it("no-ops (ok) when edoDocId is missing", async () => {
    mockDbResult.rows = [{ edoDocId: null, edoProvider: "dubidoc" }];
    const result = await revokeSigningLinkAction("act-1");
    expect(result.ok).toBe(true);
    expect(mockDeleteLinks).not.toHaveBeenCalled();
  });

  it("revokes the link and returns ok", async () => {
    mockDbResult.rows = [{ edoDocId: "doc-1", edoProvider: "dubidoc" }];
    mockDeleteLinks.mockResolvedValueOnce();

    const result = await revokeSigningLinkAction("act-1");
    expect(result.ok).toBe(true);
    expect(mockDeleteLinks).toHaveBeenCalledWith("doc-1");
  });

  it("stays ok even when revoke throws (best-effort)", async () => {
    mockDbResult.rows = [{ edoDocId: "doc-1", edoProvider: "dubidoc" }];
    mockDeleteLinks.mockRejectedValueOnce(new Error("network"));

    const result = await revokeSigningLinkAction("act-1");
    expect(result.ok).toBe(true);
  });
});

describe("finalizeInAppSigningAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbResult.rows = [];
  });

  it("returns error when act not found", async () => {
    mockDbResult.rows = [];
    const result = await finalizeInAppSigningAction("nonexistent");
    expect(result.ok).toBe(false);
    expect(mockSendDocument).not.toHaveBeenCalled();
  });

  it("no-ops (ok) for non-dubidoc act", async () => {
    mockDbResult.rows = [{ edoDocId: "doc-1", edoProvider: "vchasno_external", status: "draft" }];
    const result = await finalizeInAppSigningAction("act-1");
    expect(result.ok).toBe(true);
    expect(mockSendDocument).not.toHaveBeenCalled();
  });

  it("forwards to client when FOP signed but flow not advanced (state=new, status=signed)", async () => {
    mockDbResult.rows = [{ edoDocId: "doc-1", edoProvider: "dubidoc", status: "sent_to_edo" }];
    mockGetStatus.mockResolvedValue({ id: "doc-1", status: "signed", state: "new" });
    mockSendDocument.mockResolvedValueOnce();
    mockDeleteLinks.mockResolvedValueOnce();

    const result = await finalizeInAppSigningAction("act-1");
    expect(result.ok).toBe(true);
    expect(mockSendDocument).toHaveBeenCalledWith("doc-1");
  });

  it("does NOT forward when the FOP has not signed yet (state=new, status=new)", async () => {
    mockDbResult.rows = [{ edoDocId: "doc-1", edoProvider: "dubidoc", status: "sent_to_edo" }];
    mockGetStatus.mockResolvedValue({ id: "doc-1", status: "new", state: "new" });
    mockDeleteLinks.mockResolvedValueOnce();

    const result = await finalizeInAppSigningAction("act-1");
    expect(result.ok).toBe(true);
    expect(mockSendDocument).not.toHaveBeenCalled();
  });

  it("does NOT forward when the document is already fully signed (state=signed)", async () => {
    mockDbResult.rows = [{ edoDocId: "doc-1", edoProvider: "dubidoc", status: "sent_to_edo" }];
    mockGetStatus.mockResolvedValue({ id: "doc-1", status: "signed", state: "signed" });
    mockDeleteLinks.mockResolvedValueOnce();

    const result = await finalizeInAppSigningAction("act-1");
    expect(result.ok).toBe(true);
    expect(mockSendDocument).not.toHaveBeenCalled();
  });

  it("stays ok even when forwarding throws (best-effort)", async () => {
    mockDbResult.rows = [{ edoDocId: "doc-1", edoProvider: "dubidoc", status: "sent_to_edo" }];
    mockGetStatus.mockResolvedValue({ id: "doc-1", status: "signed", state: "new" });
    mockSendDocument.mockRejectedValueOnce(new Error("send failed"));
    mockDeleteLinks.mockResolvedValueOnce();

    const result = await finalizeInAppSigningAction("act-1");
    expect(result.ok).toBe(true);
  });
});

describe("triggerDubidocPollAction", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns ok with poll result", async () => {
    mockPoll.mockResolvedValueOnce({
      total: 5,
      signed: 2,
      waiting: 1,
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

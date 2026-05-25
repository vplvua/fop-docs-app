import { describe, expect, it, vi } from "vitest";

vi.mock("@vercel/blob", () => ({
  put: vi.fn().mockResolvedValue({ url: "https://blob.vercel-storage.com/acts/act-1.pdf" }),
  head: vi
    .fn()
    .mockResolvedValue({ url: "https://blob.vercel-storage.com/acts/act-1.pdf?token=signed" }),
}));

const { uploadActPdf, getActPdfDownloadUrl } = await import("@/lib/blob");
const { put, head } = await import("@vercel/blob");

describe("uploadActPdf", () => {
  it("calls put with correct path and options", async () => {
    const buffer = Buffer.from("fake-pdf");
    const url = await uploadActPdf("act-1", buffer);

    expect(put).toHaveBeenCalledWith("acts/act-1.pdf", buffer, {
      access: "public",
      contentType: "application/pdf",
      addRandomSuffix: false,
    });
    expect(url).toBe("https://blob.vercel-storage.com/acts/act-1.pdf");
  });
});

describe("getActPdfDownloadUrl", () => {
  it("calls head and returns URL", async () => {
    const url = await getActPdfDownloadUrl("https://blob.vercel-storage.com/acts/act-1.pdf");

    expect(head).toHaveBeenCalledWith("https://blob.vercel-storage.com/acts/act-1.pdf");
    expect(url).toBe("https://blob.vercel-storage.com/acts/act-1.pdf?token=signed");
  });
});

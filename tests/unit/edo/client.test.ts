// @vitest-environment node
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createDocument,
  deleteSigningLinks,
  generateSigningLink,
  getDocumentStatus,
} from "@/lib/external-apis/dubidoc/client";
import { DubiDocAuthError } from "@/lib/external-apis/dubidoc/types";
import type { CreateDocumentRequest } from "@/lib/external-apis/dubidoc/types";

const API_URL = "https://api.dubidoc.com.ua/api/v1/documents";

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const samplePayload: CreateDocumentRequest = {
  file: "base64pdf",
  filename: "test.pdf",
  title: "Test Act",
  date: "2026-04-30",
  number: "№4",
  amount: 600,
  signatureType: "external",
  workflowType: "sequential",
  participants: [
    {
      action: "sign",
      email: "a@b.com",
      edrpou: "12345678",
      priority: 1,
      isSignatureRequired: true,
    },
  ],
};

describe("createDocument", () => {
  beforeEach(() => {
    vi.stubEnv("DUBIDOC_TOKEN", "test-token");
    vi.stubEnv("DUBIDOC_ORGANIZATION_ID", "test-org");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns document id on success", async () => {
    server.use(http.post(API_URL, () => HttpResponse.json({ id: "doc-123", status: "new" })));

    const result = await createDocument(samplePayload);
    expect(result.id).toBe("doc-123");
    expect(result.status).toBe("new");
  });

  it("throws DubiDocAuthError on 401", async () => {
    server.use(http.post(API_URL, () => new HttpResponse(null, { status: 401 })));

    await expect(createDocument(samplePayload)).rejects.toThrow(DubiDocAuthError);
  });

  it("retries on 500 and succeeds on second attempt", async () => {
    let attempt = 0;
    server.use(
      http.post(API_URL, () => {
        attempt++;
        if (attempt === 1) return new HttpResponse(null, { status: 500 });
        return HttpResponse.json({ id: "doc-456", status: "new" });
      }),
    );

    const result = await createDocument(samplePayload);
    expect(result.id).toBe("doc-456");
    expect(attempt).toBe(2);
  });

  it("throws DubiDocAuthError when token missing", async () => {
    vi.stubEnv("DUBIDOC_TOKEN", "");

    await expect(createDocument(samplePayload)).rejects.toThrow(DubiDocAuthError);
  });
});

describe("getDocumentStatus", () => {
  beforeEach(() => {
    vi.stubEnv("DUBIDOC_TOKEN", "test-token");
    vi.stubEnv("DUBIDOC_ORGANIZATION_ID", "test-org");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns status response", async () => {
    server.use(
      http.get(`${API_URL}/doc-123`, () =>
        HttpResponse.json({ id: "doc-123", status: "signed", archived: false, refused: false }),
      ),
    );

    const result = await getDocumentStatus("doc-123");
    expect(result.status).toBe("signed");
    expect(result.archived).toBe(false);
  });

  it("throws DubiDocAuthError on 401", async () => {
    server.use(http.get(`${API_URL}/doc-123`, () => new HttpResponse(null, { status: 401 })));

    await expect(getDocumentStatus("doc-123")).rejects.toThrow(DubiDocAuthError);
  });

  it("handles 429 with retry-after", async () => {
    let attempt = 0;
    server.use(
      http.get(`${API_URL}/doc-123`, () => {
        attempt++;
        if (attempt === 1) {
          return new HttpResponse(null, {
            status: 429,
            headers: { "Retry-After": "0" },
          });
        }
        return HttpResponse.json({ id: "doc-123", status: "new" });
      }),
    );

    const result = await getDocumentStatus("doc-123");
    expect(result.status).toBe("new");
    expect(attempt).toBe(2);
  });
});

describe("generateSigningLink", () => {
  beforeEach(() => {
    vi.stubEnv("DUBIDOC_TOKEN", "test-token");
    vi.stubEnv("DUBIDOC_ORGANIZATION_ID", "test-org");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns the public link and posts action=sign", async () => {
    let body: unknown;
    server.use(
      http.post(`${API_URL}/doc-123/links`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ link: "https://my.dubidoc.com.ua/sign/abc" });
      }),
    );

    const result = await generateSigningLink("doc-123");
    expect(result.link).toBe("https://my.dubidoc.com.ua/sign/abc");
    expect(body).toEqual({ action: "sign" });
  });

  it("throws DubiDocAuthError on 401", async () => {
    server.use(
      http.post(`${API_URL}/doc-123/links`, () => new HttpResponse(null, { status: 401 })),
    );

    await expect(generateSigningLink("doc-123")).rejects.toThrow(DubiDocAuthError);
  });

  it("retries on 500 and succeeds on second attempt", async () => {
    let attempt = 0;
    server.use(
      http.post(`${API_URL}/doc-123/links`, () => {
        attempt++;
        if (attempt === 1) return new HttpResponse(null, { status: 500 });
        return HttpResponse.json({ link: "https://my.dubidoc.com.ua/sign/xyz" });
      }),
    );

    const result = await generateSigningLink("doc-123");
    expect(result.link).toBe("https://my.dubidoc.com.ua/sign/xyz");
    expect(attempt).toBe(2);
  });
});

describe("deleteSigningLinks", () => {
  beforeEach(() => {
    vi.stubEnv("DUBIDOC_TOKEN", "test-token");
    vi.stubEnv("DUBIDOC_ORGANIZATION_ID", "test-org");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("resolves on success", async () => {
    let called = false;
    server.use(
      http.delete(`${API_URL}/doc-123/links`, () => {
        called = true;
        return HttpResponse.json({ success: true });
      }),
    );

    await expect(deleteSigningLinks("doc-123")).resolves.toBeUndefined();
    expect(called).toBe(true);
  });

  it("throws DubiDocAuthError on 401", async () => {
    server.use(
      http.delete(`${API_URL}/doc-123/links`, () => new HttpResponse(null, { status: 401 })),
    );

    await expect(deleteSigningLinks("doc-123")).rejects.toThrow(DubiDocAuthError);
  });
});

// @vitest-environment node
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { fetchTransactions } from "@/lib/external-apis/privatbank/client";
import { PrivatBankAuthError } from "@/lib/external-apis/privatbank/types";

import { sampleTransaction } from "../../mocks/handlers/privatbank";

const API_URL = "https://acp.privatbank.ua/api/statements/transactions";

const server = setupServer(http.get(API_URL, () => HttpResponse.json([sampleTransaction])));

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("fetchTransactions", () => {
  it("returns transactions on success", async () => {
    const result = await fetchTransactions("test-token", "2026-04-01", "2026-04-05");
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("PB12345abcde");
  });

  it("throws PrivatBankAuthError on 401", async () => {
    server.use(http.get(API_URL, () => HttpResponse.json({}, { status: 401 })));
    await expect(fetchTransactions("bad-token", "2026-04-01", "2026-04-05")).rejects.toThrow(
      PrivatBankAuthError,
    );
  });

  it("retries on 5xx and succeeds", async () => {
    let attempts = 0;
    server.use(
      http.get(API_URL, () => {
        attempts++;
        if (attempts === 1) return HttpResponse.json({}, { status: 500 });
        return HttpResponse.json([sampleTransaction]);
      }),
    );
    const result = await fetchTransactions("test-token", "2026-04-01", "2026-04-05");
    expect(result).toHaveLength(1);
    expect(attempts).toBe(2);
  });

  it("returns empty array for non-array response", async () => {
    server.use(http.get(API_URL, () => HttpResponse.json({ data: "not-array" })));
    const result = await fetchTransactions("test-token", "2026-04-01", "2026-04-05");
    expect(result).toHaveLength(0);
  });
});

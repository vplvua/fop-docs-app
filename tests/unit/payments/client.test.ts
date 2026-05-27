// @vitest-environment node
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { fetchTransactions } from "@/lib/external-apis/privatbank/client";
import { PrivatBankAuthError } from "@/lib/external-apis/privatbank/types";

import { privatbankHandlers, sampleTransaction } from "../../mocks/handlers/privatbank";

const API_URL = "https://acp.privatbank.ua/api/statements/transactions/interim";

const server = setupServer(...privatbankHandlers);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("fetchTransactions", () => {
  it("returns confirmed transactions on success", async () => {
    const result = await fetchTransactions("test-token", "UA123");
    expect(result).toHaveLength(1);
    expect(result[0]?.REF).toBe("REF001");
  });

  it("throws PrivatBankAuthError on 401", async () => {
    server.use(http.get(API_URL, () => HttpResponse.json({}, { status: 401 })));
    await expect(fetchTransactions("bad-token", "UA123")).rejects.toThrow(PrivatBankAuthError);
  });

  it("filters out non-confirmed transactions", async () => {
    const pending = { ...sampleTransaction, PR_PR: "p" as const };
    server.use(
      http.get(API_URL, () =>
        HttpResponse.json({
          status: "SUCCESS",
          type: "transactions",
          exist_next_page: false,
          next_page_id: null,
          transactions: [sampleTransaction, pending],
        }),
      ),
    );
    const result = await fetchTransactions("test-token", "UA123");
    expect(result).toHaveLength(1);
  });

  it("returns empty array when no transactions", async () => {
    server.use(
      http.get(API_URL, () =>
        HttpResponse.json({
          status: "SUCCESS",
          type: "transactions",
          exist_next_page: false,
          next_page_id: null,
          transactions: [],
        }),
      ),
    );
    const result = await fetchTransactions("test-token", "UA123");
    expect(result).toHaveLength(0);
  });
});

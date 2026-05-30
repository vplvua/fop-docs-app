// @vitest-environment node
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { fetchTransactionsByDate, toApiDate } from "@/lib/external-apis/privatbank/client";
import { PrivatBankAuthError } from "@/lib/external-apis/privatbank/types";

import { privatbankHandlers, sampleTransaction } from "../../mocks/handlers/privatbank";

const API_URL = "https://acp.privatbank.ua/api/statements/transactions";

const server = setupServer(...privatbankHandlers);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("toApiDate", () => {
  it("converts YYYY-MM-DD to DD-MM-YYYY", () => {
    expect(toApiDate("2026-04-28")).toBe("28-04-2026");
  });
});

describe("fetchTransactionsByDate", () => {
  it("sends startDate/endDate in DD-MM-YYYY and returns confirmed transactions", async () => {
    let seen: URL | undefined;
    server.use(
      http.get(API_URL, ({ request }) => {
        seen = new URL(request.url);
        return HttpResponse.json({
          status: "SUCCESS",
          type: "transactions",
          exist_next_page: false,
          next_page_id: null,
          transactions: [sampleTransaction],
        });
      }),
    );

    const result = await fetchTransactionsByDate("test-token", "UA123", "2026-04-28");

    expect(seen?.searchParams.get("startDate")).toBe("28-04-2026");
    expect(seen?.searchParams.get("endDate")).toBe("28-04-2026");
    expect(seen?.searchParams.get("acc")).toBe("UA123");
    expect(result).toHaveLength(1);
    expect(result[0]?.REF).toBe("REF001");
  });

  it("defaults endDate to startDate, or uses an explicit range", async () => {
    let seen: URL | undefined;
    server.use(
      http.get(API_URL, ({ request }) => {
        seen = new URL(request.url);
        return HttpResponse.json({
          status: "SUCCESS",
          type: "transactions",
          exist_next_page: false,
          next_page_id: null,
          transactions: [],
        });
      }),
    );

    await fetchTransactionsByDate("t", "UA1", "2026-04-01", "2026-04-15");
    expect(seen?.searchParams.get("startDate")).toBe("01-04-2026");
    expect(seen?.searchParams.get("endDate")).toBe("15-04-2026");
  });

  it("follows pagination via followId until exist_next_page is false", async () => {
    const page1 = {
      status: "SUCCESS" as const,
      type: "transactions" as const,
      exist_next_page: true,
      next_page_id: "PAGE2",
      transactions: [sampleTransaction],
    };
    const page2 = {
      status: "SUCCESS" as const,
      type: "transactions" as const,
      exist_next_page: false,
      next_page_id: null,
      transactions: [{ ...sampleTransaction, REF: "REF002", REFN: "N002" }],
    };
    server.use(
      http.get(API_URL, ({ request }) => {
        const followId = new URL(request.url).searchParams.get("followId");
        return HttpResponse.json(followId === "PAGE2" ? page2 : page1);
      }),
    );

    const result = await fetchTransactionsByDate("t", "UA1", "2026-04-28");
    expect(result.map((r) => r.REF)).toEqual(["REF001", "REF002"]);
  });

  it("filters out non-confirmed transactions", async () => {
    server.use(
      http.get(API_URL, () =>
        HttpResponse.json({
          status: "SUCCESS",
          type: "transactions",
          exist_next_page: false,
          next_page_id: null,
          transactions: [sampleTransaction, { ...sampleTransaction, PR_PR: "p", REF: "X" }],
        }),
      ),
    );
    const result = await fetchTransactionsByDate("t", "UA1", "2026-04-28");
    expect(result).toHaveLength(1);
  });

  it("throws PrivatBankAuthError on 401", async () => {
    server.use(http.get(API_URL, () => HttpResponse.json({}, { status: 401 })));
    await expect(fetchTransactionsByDate("bad", "UA1", "2026-04-28")).rejects.toThrow(
      PrivatBankAuthError,
    );
  });
});

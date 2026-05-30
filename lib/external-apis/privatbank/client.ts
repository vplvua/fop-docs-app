import { logger } from "@/lib/logging";

import { PrivatBankApiError, PrivatBankAuthError } from "./types";
import type { PrivatBankTransaction, PrivatBankTransactionsResponse } from "./types";

const RETRY_DELAYS = [1000, 5000, 30000];
const API_INTERIM = "https://acp.privatbank.ua/api/statements/transactions/interim";
const API_BY_DATE = "https://acp.privatbank.ua/api/statements/transactions";

/** Convert a `YYYY-MM-DD` date to the PrivatBank `DD-MM-YYYY` statement format. */
export function toApiDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  return `${day}-${month}-${year}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function attemptFetch(
  url: string,
  token: string,
  attempt: number,
): Promise<PrivatBankTransactionsResponse> {
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { token, "Content-Type": "application/json;charset=utf-8" },
    });
  } catch (err) {
    return handleRetry(url, token, attempt, err as Error);
  }

  if (res.status === 401) {
    throw new PrivatBankAuthError("PrivatBank token is invalid or expired (401)");
  }

  if (res.status === 429) {
    const retryAfter = Number(res.headers.get("Retry-After") ?? "60");
    logger.warn({ event: "privatbank.rate_limited", retryAfter }, "PrivatBank 429, waiting");
    await sleep(retryAfter * 1000);
    return attemptFetch(url, token, attempt);
  }

  if (!res.ok) {
    return handleRetry(
      url,
      token,
      attempt,
      new PrivatBankApiError(res.status, `PrivatBank API error: ${String(res.status)}`),
    );
  }

  return (await res.json()) as PrivatBankTransactionsResponse;
}

async function handleRetry(
  url: string,
  token: string,
  attempt: number,
  err: Error,
): Promise<PrivatBankTransactionsResponse> {
  if (attempt >= RETRY_DELAYS.length) throw err;
  const delay = RETRY_DELAYS[attempt] ?? 1000;
  logger.warn(
    { event: "privatbank.retry", attempt: attempt + 1, delay },
    "PrivatBank request failed, retrying",
  );
  await sleep(delay);
  return attemptFetch(url, token, attempt + 1);
}

/** Extra, page-invariant query params (e.g. statement date range). */
type QueryParams = Record<string, string>;

async function fetchPage(
  baseUrl: string,
  token: string,
  account: string,
  extraParams: QueryParams,
  followId: string | null,
): Promise<{ transactions: PrivatBankTransaction[]; nextPageId: string | null }> {
  const url = new URL(baseUrl);
  url.searchParams.set("acc", account);
  url.searchParams.set("limit", "100");
  for (const [key, value] of Object.entries(extraParams)) {
    url.searchParams.set(key, value);
  }
  if (followId) {
    url.searchParams.set("followId", followId);
  }

  const data = await attemptFetch(url.toString(), token, 0);

  if (data.status !== "SUCCESS") {
    throw new PrivatBankApiError(200, `PrivatBank API status: ${data.status}`);
  }

  const confirmed = data.transactions.filter((txn) => txn.PR_PR === "r" && txn.FL_REAL === "r");
  return { transactions: confirmed, nextPageId: data.exist_next_page ? data.next_page_id : null };
}

async function fetchAllPages(
  baseUrl: string,
  token: string,
  account: string,
  extraParams: QueryParams,
  followId: string | null,
  accumulated: PrivatBankTransaction[],
): Promise<PrivatBankTransaction[]> {
  const result = await fetchPage(baseUrl, token, account, extraParams, followId);
  const all = [...accumulated, ...result.transactions];
  if (!result.nextPageId) return all;
  return fetchAllPages(baseUrl, token, account, extraParams, result.nextPageId, all);
}

/** Interim statement (lastday→today) — the source for cron polling. */
export async function fetchTransactions(
  token: string,
  account: string,
): Promise<PrivatBankTransaction[]> {
  return fetchAllPages(API_INTERIM, token, account, {}, null, []);
}

/**
 * Dated statement for a known period. `startDate`/`endDate` are `YYYY-MM-DD`;
 * `endDate` defaults to `startDate` for a single-day fetch. Reuses the same
 * paging, retry/backoff, and confirmed-transaction filter as interim polling.
 */
export async function fetchTransactionsByDate(
  token: string,
  account: string,
  startDate: string,
  endDate?: string,
): Promise<PrivatBankTransaction[]> {
  const params: QueryParams = {
    startDate: toApiDate(startDate),
    endDate: toApiDate(endDate ?? startDate),
  };
  return fetchAllPages(API_BY_DATE, token, account, params, null, []);
}

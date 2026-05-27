import { logger } from "@/lib/logging";

import { PrivatBankApiError, PrivatBankAuthError } from "./types";
import type { PrivatBankTransaction, PrivatBankTransactionsResponse } from "./types";

const RETRY_DELAYS = [1000, 5000, 30000];
const API_BASE = "https://acp.privatbank.ua/api/statements/transactions/interim";

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

async function fetchPage(
  token: string,
  account: string,
  followId: string | null,
): Promise<{ transactions: PrivatBankTransaction[]; nextPageId: string | null }> {
  const url = new URL(API_BASE);
  url.searchParams.set("acc", account);
  url.searchParams.set("limit", "100");
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
  token: string,
  account: string,
  followId: string | null,
  accumulated: PrivatBankTransaction[],
): Promise<PrivatBankTransaction[]> {
  const result = await fetchPage(token, account, followId);
  const all = [...accumulated, ...result.transactions];
  if (!result.nextPageId) return all;
  return fetchAllPages(token, account, result.nextPageId, all);
}

export async function fetchTransactions(
  token: string,
  account: string,
): Promise<PrivatBankTransaction[]> {
  return fetchAllPages(token, account, null, []);
}

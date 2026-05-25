import { logger } from "@/lib/logging";

import { PrivatBankApiError, PrivatBankAuthError } from "./types";
import type { PrivatBankTransaction } from "./types";

const RETRY_DELAYS = [1000, 5000, 30000];
const API_BASE = "https://acp.privatbank.ua/api/statements/transactions";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function attemptFetch(
  url: string,
  token: string,
  attempt: number,
): Promise<PrivatBankTransaction[]> {
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
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

  const data: unknown = await res.json();
  return Array.isArray(data) ? (data as PrivatBankTransaction[]) : [];
}

async function handleRetry(
  url: string,
  token: string,
  attempt: number,
  err: Error,
): Promise<PrivatBankTransaction[]> {
  if (attempt >= RETRY_DELAYS.length) throw err;
  const delay = RETRY_DELAYS[attempt] ?? 1000;
  logger.warn(
    { event: "privatbank.retry", attempt: attempt + 1, delay },
    "PrivatBank request failed, retrying",
  );
  await sleep(delay);
  return attemptFetch(url, token, attempt + 1);
}

export async function fetchTransactions(
  token: string,
  dateFrom: string,
  dateTo: string,
): Promise<PrivatBankTransaction[]> {
  const url = `${API_BASE}?startDate=${dateFrom}&endDate=${dateTo}`;
  return attemptFetch(url, token, 0);
}

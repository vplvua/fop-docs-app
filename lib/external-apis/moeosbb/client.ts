import { logger } from "@/lib/logging";

import { MoeosbbApiError, MoeosbbAuthError } from "./types";
import type { MoeosbbRemoteClient, MoeosbbSyncResponse } from "./types";

const RETRY_DELAYS = [1000, 5000, 30000];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function attemptFetch(
  url: string,
  token: string,
  attempt: number,
): Promise<MoeosbbRemoteClient[]> {
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (err) {
    return handleRetry(url, token, attempt, err as Error);
  }

  if (res.status === 401) {
    throw new MoeosbbAuthError("MoeOSBB sync token is invalid (401)");
  }

  if (!res.ok) {
    return handleRetry(
      url,
      token,
      attempt,
      new MoeosbbApiError(res.status, `MoeOSBB API error: ${String(res.status)}`),
    );
  }

  const data: unknown = await res.json();
  const typed = data as MoeosbbSyncResponse;
  if (!typed.ok || !Array.isArray(typed.clients)) {
    throw new MoeosbbApiError(200, "MoeOSBB response missing ok:true or clients array");
  }

  return typed.clients;
}

async function handleRetry(
  url: string,
  token: string,
  attempt: number,
  err: Error,
): Promise<MoeosbbRemoteClient[]> {
  if (attempt >= RETRY_DELAYS.length) throw err;
  const delay = RETRY_DELAYS[attempt] ?? 1000;
  logger.warn(
    { event: "moeosbb.retry", attempt: attempt + 1, delay, error: err.message },
    "retrying",
  );
  await sleep(delay);
  return attemptFetch(url, token, attempt + 1);
}

export async function fetchMoeosbbClients(): Promise<MoeosbbRemoteClient[]> {
  const url = process.env.MOEOSBB_SYNC_URL;
  const token = process.env.MOEOSBB_SYNC_TOKEN;
  if (!url || !token) {
    throw new Error("MOEOSBB_SYNC_URL and MOEOSBB_SYNC_TOKEN must be set");
  }
  return attemptFetch(url, token, 0);
}

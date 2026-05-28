import { logger } from "@/lib/logging";

import { DubiDocApiError, DubiDocAuthError } from "./types";
import type {
  CreateDocumentRequest,
  CreateDocumentResponse,
  DocumentStatusResponse,
} from "./types";

const RETRY_DELAYS = [1000, 5000, 30000];
const API_BASE = "https://api.dubidoc.com.ua/api/v1";

function getAuthHeaders(): Record<string, string> {
  const token = process.env.DUBIDOC_TOKEN;
  if (!token) throw new DubiDocAuthError("DUBIDOC_TOKEN is not configured");
  const organization = process.env.DUBIDOC_ORGANIZATION_ID;
  if (!organization) throw new DubiDocAuthError("DUBIDOC_ORGANIZATION_ID is not configured");
  return {
    "X-Access-Token": token,
    "X-Organization": organization,
    "Content-Type": "application/json",
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function handleResponse<T>(res: Response, context: string): Promise<T> {
  if (res.status === 401) {
    throw new DubiDocAuthError("DubiDoc token is invalid or expired (401)");
  }

  if (!res.ok) {
    throw new DubiDocApiError(res.status, `DubiDoc API error: ${String(res.status)} (${context})`);
  }

  return (await res.json()) as T;
}

async function attemptRequest<T>(
  url: string,
  init: RequestInit,
  context: string,
  attempt: number,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (err) {
    return retryOrThrow(url, init, context, attempt, err as Error);
  }

  if (res.status === 429) {
    const retryAfter = Number(res.headers.get("Retry-After") ?? "60");
    logger.warn({ event: "dubidoc.rate_limited", retryAfter }, "DubiDoc 429, waiting");
    await sleep(retryAfter * 1000);
    return attemptRequest(url, init, context, attempt);
  }

  if (res.status >= 500) {
    return retryOrThrow(
      url,
      init,
      context,
      attempt,
      new DubiDocApiError(res.status, `DubiDoc server error: ${String(res.status)}`),
    );
  }

  return handleResponse<T>(res, context);
}

async function retryOrThrow<T>(
  url: string,
  init: RequestInit,
  context: string,
  attempt: number,
  err: Error,
): Promise<T> {
  if (attempt >= RETRY_DELAYS.length) throw err;
  const delay = RETRY_DELAYS[attempt] ?? 1000;
  logger.warn(
    { event: "dubidoc.retry", attempt: attempt + 1, delay, context },
    "DubiDoc request failed, retrying",
  );
  await sleep(delay);
  return attemptRequest(url, init, context, attempt + 1);
}

export async function createDocument(
  payload: CreateDocumentRequest,
): Promise<CreateDocumentResponse> {
  return attemptRequest<CreateDocumentResponse>(
    `${API_BASE}/documents`,
    {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    },
    "createDocument",
    0,
  );
}

export async function getDocumentStatus(docId: string): Promise<DocumentStatusResponse> {
  return attemptRequest<DocumentStatusResponse>(
    `${API_BASE}/documents/${docId}`,
    {
      method: "GET",
      headers: getAuthHeaders(),
    },
    "getDocumentStatus",
    0,
  );
}

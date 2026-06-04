import { logger } from "@/lib/logging";

import { DubiDocApiError, DubiDocAuthError } from "./types";
import type {
  CreateDocumentRequest,
  CreateDocumentResponse,
  DocumentStatusResponse,
  GenerateLinkResponse,
} from "./types";

const RETRY_DELAYS = [1000, 5000, 30000];
// A 429 must NOT loop forever: bound the number of rate-limit waits and cap each
// wait so a single request can never block a serverless function indefinitely.
const MAX_RATE_LIMIT_RETRIES = 2;
const MAX_RATE_LIMIT_WAIT_MS = 30000;
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
    if (attempt >= MAX_RATE_LIMIT_RETRIES) {
      throw new DubiDocApiError(
        429,
        `DubiDoc rate limited (429) after ${String(attempt)} retries (${context})`,
      );
    }
    const retryAfter = Number(res.headers.get("Retry-After") ?? "60");
    const waitMs = Math.min(retryAfter * 1000, MAX_RATE_LIMIT_WAIT_MS);
    logger.warn(
      { event: "dubidoc.rate_limited", retryAfter, waitMs, attempt: attempt + 1 },
      "DubiDoc 429, waiting",
    );
    await sleep(waitMs);
    return attemptRequest(url, init, context, attempt + 1);
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

/**
 * Generate a public, action-scoped signing URL for a document. DubiDoc returns
 * the same URL for repeated `action: "sign"` calls until the link is revoked.
 * The returned link is meant to be embedded in an `<iframe>` so the FOP can sign
 * without leaving the app.
 */
export async function generateSigningLink(docId: string): Promise<GenerateLinkResponse> {
  return attemptRequest<GenerateLinkResponse>(
    `${API_BASE}/documents/${docId}/links`,
    {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ action: "sign" }),
    },
    "generateSigningLink",
    0,
  );
}

/**
 * Start the document flow — forward the document down its sequential route to
 * the first participant (the client). Required after the FOP signs via the
 * public sign link, because a public-link signature applies the owner's
 * signature but does NOT advance the route (unlike the website's "Підписати та
 * надіслати"). DubiDoc requires an empty JSON object as the body.
 */
export async function sendDocument(docId: string): Promise<void> {
  await attemptRequest<{ success: boolean }>(
    `${API_BASE}/documents/${docId}/send`,
    {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({}),
    },
    "sendDocument",
    0,
  );
}

/**
 * Revoke ALL public links for a document (DubiDoc has no per-action delete).
 * Called right after the FOP signs to minimize the window the public sign URL
 * is usable. Safe to call when no links exist.
 */
export async function deleteSigningLinks(docId: string): Promise<void> {
  await attemptRequest<{ success: boolean }>(
    `${API_BASE}/documents/${docId}/links`,
    {
      method: "DELETE",
      headers: getAuthHeaders(),
    },
    "deleteSigningLinks",
    0,
  );
}

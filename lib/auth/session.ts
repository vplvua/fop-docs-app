import { createHmac, randomBytes } from "node:crypto";

import { eq, lt } from "drizzle-orm";

import { db } from "@/lib/db";
import { sessions } from "@/lib/db/schema/auth";

import { SESSION_TTL_SECONDS } from "./cookie";

export type Clock = () => Date;

const defaultClock: Clock = () => new Date();

function requireSecret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) {
    throw new Error(
      "SESSION_SECRET is not set. Generate with `openssl rand -base64 48` " +
        "and add via `vercel env add SESSION_SECRET` (see AGENTS.md).",
    );
  }
  return s;
}

/**
 * Deterministic HMAC-SHA256 of the raw session token, keyed by
 * `SESSION_SECRET`. Stored in `sessions.token_hash`; cookie carries the raw
 * token. Rotating the secret invalidates every existing session.
 */
export function hashToken(rawToken: string, secret = requireSecret()): string {
  return createHmac("sha256", secret).update(rawToken, "utf8").digest("base64url");
}

export interface CreateSessionInput {
  ip?: string | null;
  now?: Clock;
}

export interface CreatedSession {
  rawToken: string;
  tokenHash: string;
  expiresAt: Date;
}

export async function createSession({
  ip,
  now = defaultClock,
}: CreateSessionInput = {}): Promise<CreatedSession> {
  const rawToken = randomBytes(32).toString("base64url");
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(now().getTime() + SESSION_TTL_SECONDS * 1000);
  await db.insert(sessions).values({
    tokenHash,
    expiresAt,
    ip: ip ?? null,
  });
  return { rawToken, tokenHash, expiresAt };
}

export interface ValidatedSession {
  tokenHash: string;
  expiresAt: Date;
}

/**
 * Look up a session by raw cookie token. Returns null for missing,
 * unknown, or expired sessions. Expired rows are deleted opportunistically.
 */
export async function validateSession(
  rawToken: string | undefined | null,
  { now = defaultClock }: { now?: Clock } = {},
): Promise<ValidatedSession | null> {
  if (!rawToken) return null;
  const tokenHash = hashToken(rawToken);
  const rows = await db
    .select({ expiresAt: sessions.expiresAt })
    .from(sessions)
    .where(eq(sessions.tokenHash, tokenHash))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  if (row.expiresAt.getTime() <= now().getTime()) {
    // Best-effort cleanup; ignore failures (handled by future cleanup cron).
    await db
      .delete(sessions)
      .where(eq(sessions.tokenHash, tokenHash))
      .catch(() => undefined);
    return null;
  }
  return { tokenHash, expiresAt: row.expiresAt };
}

/**
 * Idempotent — deleting a non-existent token is not an error.
 */
export async function destroySession(rawToken: string | undefined | null): Promise<void> {
  if (!rawToken) return;
  const tokenHash = hashToken(rawToken);
  await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
}

/**
 * Optional cleanup helper for a future cron (§9.1). Exposed now so the
 * smoke / unit tests can exercise it without re-implementing the predicate.
 */
export async function deleteExpiredSessions(now: Clock = defaultClock): Promise<void> {
  await db.delete(sessions).where(lt(sessions.expiresAt, now()));
}

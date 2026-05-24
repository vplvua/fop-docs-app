import { and, count, eq, gt, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { loginAttempts } from "@/lib/db/schema/auth";

import type { Clock } from "./session";

// see FR-AUTH-05: 10 невдалих спроб за 60 хвилин з одного IP → block.
export const RATE_LIMIT_MAX_FAILURES = 10;
export const RATE_LIMIT_WINDOW_SECONDS = 60 * 60;

const defaultClock: Clock = () => new Date();

export type RateLimitResult =
  | { allowed: true; attemptsInWindow: number }
  | { allowed: false; attemptsInWindow: number; retryAfterSec: number };

function windowStart(now: Date): Date {
  return new Date(now.getTime() - RATE_LIMIT_WINDOW_SECONDS * 1000);
}

export async function checkRateLimit(
  ip: string,
  { now = defaultClock }: { now?: Clock } = {},
): Promise<RateLimitResult> {
  const since = windowStart(now());
  const [countRow] = await db
    .select({ n: count() })
    .from(loginAttempts)
    .where(
      and(
        eq(loginAttempts.ip, ip),
        eq(loginAttempts.success, false),
        gt(loginAttempts.attemptedAt, since),
      ),
    );
  const attemptsInWindow = Number(countRow?.n ?? 0);
  if (attemptsInWindow < RATE_LIMIT_MAX_FAILURES) {
    return { allowed: true, attemptsInWindow };
  }
  // Earliest failure currently in the window dictates when blocking ends.
  const oldest = await db
    .select({ at: loginAttempts.attemptedAt })
    .from(loginAttempts)
    .where(
      and(
        eq(loginAttempts.ip, ip),
        eq(loginAttempts.success, false),
        gt(loginAttempts.attemptedAt, since),
      ),
    )
    .orderBy(loginAttempts.attemptedAt)
    .limit(1);
  const earliestMs = oldest[0]?.at.getTime() ?? now().getTime();
  const unblockMs = earliestMs + RATE_LIMIT_WINDOW_SECONDS * 1000;
  const retryAfterSec = Math.max(1, Math.ceil((unblockMs - now().getTime()) / 1000));
  return { allowed: false, attemptsInWindow, retryAfterSec };
}

export async function recordFailure(ip: string): Promise<void> {
  await db.insert(loginAttempts).values({ ip, success: false });
}

/**
 * On success: insert a success row AND clear prior failures for this IP so
 * the window starts fresh. HTTP driver has no `db.transaction()`; the two
 * statements run sequentially. Worst-case race: a parallel failed attempt
 * lands between them, leaving a stray failed row whose count will not
 * exceed 1 — the next request resets it again on success.
 */
export async function recordSuccess(ip: string): Promise<void> {
  await db.insert(loginAttempts).values({ ip, success: true });
  await db
    .delete(loginAttempts)
    .where(and(eq(loginAttempts.ip, ip), eq(loginAttempts.success, false)));
}

/**
 * Optional cleanup helper for the future cron (§9.1). Drops failed attempts
 * older than 7 days to keep the table bounded.
 */
export async function deleteOldLoginAttempts(now: Clock = defaultClock): Promise<void> {
  const cutoff = new Date(now().getTime() - 7 * 24 * 60 * 60 * 1000);
  await db.delete(loginAttempts).where(sql`${loginAttempts.attemptedAt} < ${cutoff}`);
}

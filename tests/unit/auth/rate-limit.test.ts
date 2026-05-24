/* eslint-disable unicorn/no-thenable -- mirrors Drizzle's thenable query builder. */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RATE_LIMIT_MAX_FAILURES, RATE_LIMIT_WINDOW_SECONDS } from "@/lib/auth/rate-limit";

/**
 * Drizzle's query builder is "thenable" — awaiting any chain resolves it.
 * `vi.mock` is hoisted to file top, so the fake must be constructed inside
 * `vi.hoisted` to be available when the mock factory runs.
 */
const { nextSelectQueue, inserted, deleteCallCount, fakeDb } = vi.hoisted(() => {
  type SelectResult = unknown[];
  const nextSelectQueueLocal: SelectResult[] = [];
  const insertedLocal: unknown[] = [];
  const deleteCallCountLocal = { n: 0 };

  function makeChain(): unknown {
    const chain: Record<string, unknown> = {};
    const passthrough = () => chain;
    for (const m of ["from", "where", "orderBy", "limit"]) {
      chain[m] = passthrough;
    }
    chain["then"] = (resolve: (v: SelectResult) => unknown) => {
      const rows = nextSelectQueueLocal.shift() ?? [];
      return Promise.resolve(resolve(rows));
    };
    return chain;
  }

  const fakeDbLocal = {
    select: () => makeChain(),
    insert: () => ({
      values: (v: unknown) => {
        insertedLocal.push(v);
        return Promise.resolve();
      },
    }),
    delete: () => ({
      where: () => {
        deleteCallCountLocal.n += 1;
        return Promise.resolve();
      },
    }),
  };

  return {
    nextSelectQueue: nextSelectQueueLocal,
    inserted: insertedLocal,
    deleteCallCount: deleteCallCountLocal,
    fakeDb: fakeDbLocal,
  };
});

vi.mock("@/lib/db", () => ({ db: fakeDb }));

beforeEach(() => {
  nextSelectQueue.length = 0;
  inserted.length = 0;
  deleteCallCount.n = 0;
});

describe("checkRateLimit", () => {
  it("allows when failure count is below limit", async () => {
    const { checkRateLimit } = await import("@/lib/auth/rate-limit");
    nextSelectQueue.push([{ n: RATE_LIMIT_MAX_FAILURES - 1 }]);
    const r = await checkRateLimit("1.2.3.4");
    expect(r.allowed).toBe(true);
    if (r.allowed) expect(r.attemptsInWindow).toBe(RATE_LIMIT_MAX_FAILURES - 1);
  });

  it("blocks at exactly RATE_LIMIT_MAX_FAILURES", async () => {
    const { checkRateLimit } = await import("@/lib/auth/rate-limit");
    const now = new Date("2026-05-24T12:00:00Z");
    // 30 minutes ago
    const earliest = new Date(now.getTime() - 30 * 60 * 1000);
    nextSelectQueue.push([{ n: RATE_LIMIT_MAX_FAILURES }]);
    nextSelectQueue.push([{ at: earliest }]);
    const r = await checkRateLimit("1.2.3.4", { now: () => now });
    expect(r.allowed).toBe(false);
    if (!r.allowed) {
      const expectedMs = earliest.getTime() + RATE_LIMIT_WINDOW_SECONDS * 1000 - now.getTime();
      const expectedSec = Math.ceil(expectedMs / 1000);
      expect(r.retryAfterSec).toBe(expectedSec);
      expect(r.attemptsInWindow).toBe(RATE_LIMIT_MAX_FAILURES);
    }
  });

  it("retryAfterSec rounds up (ceil) for sub-second remainders", async () => {
    const { checkRateLimit } = await import("@/lib/auth/rate-limit");
    const now = new Date("2026-05-24T12:00:00.500Z");
    // earliest ≈ now − (window − 0.4s) → ~0.4s of block remaining; ceil → 1.
    const earliest = new Date(now.getTime() - (RATE_LIMIT_WINDOW_SECONDS - 0.4) * 1000);
    nextSelectQueue.push([{ n: RATE_LIMIT_MAX_FAILURES + 5 }]);
    nextSelectQueue.push([{ at: earliest }]);
    const r = await checkRateLimit("1.2.3.4", { now: () => now });
    expect(r.allowed).toBe(false);
    if (!r.allowed) expect(r.retryAfterSec).toBe(1);
  });

  it("returns at least 1 second when window already elapsed", async () => {
    const { checkRateLimit } = await import("@/lib/auth/rate-limit");
    const now = new Date("2026-05-24T12:00:00Z");
    nextSelectQueue.push([{ n: RATE_LIMIT_MAX_FAILURES }]);
    nextSelectQueue.push([]);
    const r = await checkRateLimit("1.2.3.4", { now: () => now });
    expect(r.allowed).toBe(false);
    if (!r.allowed) expect(r.retryAfterSec).toBeGreaterThanOrEqual(1);
  });
});

describe("recordSuccess / recordFailure", () => {
  it("recordFailure inserts a row with success=false", async () => {
    const { recordFailure } = await import("@/lib/auth/rate-limit");
    await recordFailure("1.2.3.4");
    expect(inserted).toEqual([{ ip: "1.2.3.4", success: false }]);
  });

  it("recordSuccess inserts a success row and clears failed attempts", async () => {
    const { recordSuccess } = await import("@/lib/auth/rate-limit");
    await recordSuccess("1.2.3.4");
    expect(inserted).toEqual([{ ip: "1.2.3.4", success: true }]);
    expect(deleteCallCount.n).toBe(1);
  });
});

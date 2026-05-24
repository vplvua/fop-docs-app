/* eslint-disable unicorn/no-thenable -- mirrors Drizzle's thenable query builder. */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { fakeDb, inserts, deletes, nextSelectRows } = vi.hoisted(() => {
  type Row = { expiresAt: Date };
  const insertsLocal: Array<Record<string, unknown>> = [];
  const deletesLocal: { count: number } = { count: 0 };
  const nextSelectRowsLocal: Row[][] = [];

  function makeSelectChain(): unknown {
    const chain: Record<string, unknown> = {};
    const passthrough = () => chain;
    for (const m of ["from", "where", "limit"]) chain[m] = passthrough;
    chain["then"] = (resolve: (rows: Row[]) => unknown) => {
      const rows = nextSelectRowsLocal.shift() ?? [];
      return Promise.resolve(resolve(rows));
    };
    return chain;
  }

  const fakeDbLocal = {
    select: () => makeSelectChain(),
    insert: () => ({
      values: (v: Record<string, unknown>) => {
        insertsLocal.push(v);
        return Promise.resolve();
      },
    }),
    delete: () => ({
      where: () => {
        deletesLocal.count += 1;
        return Promise.resolve();
      },
    }),
  };

  return {
    fakeDb: fakeDbLocal,
    inserts: insertsLocal,
    deletes: deletesLocal,
    nextSelectRows: nextSelectRowsLocal,
  };
});

vi.mock("@/lib/db", () => ({ db: fakeDb }));

const ORIGINAL_SECRET = process.env.SESSION_SECRET;
beforeEach(() => {
  process.env.SESSION_SECRET = ORIGINAL_SECRET ?? "test-secret-aaaa-bbbb-cccc-dddd-eeee-ffff";
  inserts.length = 0;
  deletes.count = 0;
  nextSelectRows.length = 0;
});

describe("createSession", () => {
  it("inserts a row with HMAC token hash and 30-day expiry", async () => {
    const { createSession, hashToken, SESSION_TTL_SECONDS } = await import("@/lib/auth");
    const now = new Date("2026-05-24T12:00:00Z");
    const { rawToken, tokenHash, expiresAt } = await createSession({
      ip: "1.2.3.4",
      now: () => now,
    });
    expect(rawToken).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(tokenHash).toBe(hashToken(rawToken));
    expect(expiresAt.getTime()).toBe(now.getTime() + SESSION_TTL_SECONDS * 1000);
    expect(inserts).toHaveLength(1);
    expect(inserts[0]).toEqual({ tokenHash, expiresAt, ip: "1.2.3.4" });
  });

  it("stores null IP when none is provided", async () => {
    const { createSession } = await import("@/lib/auth");
    await createSession({ now: () => new Date("2026-05-24T12:00:00Z") });
    expect(inserts[0]).toMatchObject({ ip: null });
  });
});

describe("validateSession", () => {
  it("returns null when raw token is missing", async () => {
    const { validateSession } = await import("@/lib/auth");
    await expect(validateSession(null)).resolves.toBeNull();
    await expect(validateSession(undefined)).resolves.toBeNull();
    await expect(validateSession("")).resolves.toBeNull();
  });

  it("returns null and cleans up when row is expired", async () => {
    const { validateSession } = await import("@/lib/auth");
    const now = new Date("2026-05-24T12:00:00Z");
    nextSelectRows.push([{ expiresAt: new Date(now.getTime() - 1000) }]);
    const r = await validateSession("anything", { now: () => now });
    expect(r).toBeNull();
    expect(deletes.count).toBe(1);
  });

  it("returns the session when the row is still valid", async () => {
    const { validateSession } = await import("@/lib/auth");
    const now = new Date("2026-05-24T12:00:00Z");
    const expiresAt = new Date(now.getTime() + 60_000);
    nextSelectRows.push([{ expiresAt }]);
    const r = await validateSession("anything", { now: () => now });
    expect(r).not.toBeNull();
    expect(r?.expiresAt).toEqual(expiresAt);
    expect(deletes.count).toBe(0);
  });

  it("returns null for an unknown token (no row in DB)", async () => {
    const { validateSession } = await import("@/lib/auth");
    nextSelectRows.push([]);
    const r = await validateSession("ghost-token");
    expect(r).toBeNull();
    expect(deletes.count).toBe(0);
  });
});

describe("destroySession", () => {
  it("is a no-op for missing token", async () => {
    const { destroySession } = await import("@/lib/auth");
    await destroySession(null);
    await destroySession(undefined);
    await destroySession("");
    expect(deletes.count).toBe(0);
  });

  it("issues exactly one DELETE for a present token", async () => {
    const { destroySession } = await import("@/lib/auth");
    await destroySession("some-token");
    expect(deletes.count).toBe(1);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

// `lib/db` reads POSTGRES_URL at import time; stub before importing session.ts.
vi.mock("@/lib/db", () => ({ db: {} }));

const ORIGINAL_SECRET = process.env.SESSION_SECRET;
beforeEach(() => {
  process.env.SESSION_SECRET = ORIGINAL_SECRET ?? "test-secret-aaaa-bbbb-cccc-dddd-eeee-ffff";
});

describe("hashToken", () => {
  it("is deterministic for the same input", async () => {
    const { hashToken } = await import("@/lib/auth/session");
    expect(hashToken("token-a")).toBe(hashToken("token-a"));
  });

  it("produces different hashes for different secrets", async () => {
    const { hashToken } = await import("@/lib/auth/session");
    const a = hashToken("token-a", "secret-one");
    const b = hashToken("token-a", "secret-two");
    expect(a).not.toBe(b);
  });

  it("produces different hashes for different tokens", async () => {
    const { hashToken } = await import("@/lib/auth/session");
    expect(hashToken("token-a")).not.toBe(hashToken("token-b"));
  });

  it("returns base64url (no +/= characters)", async () => {
    const { hashToken } = await import("@/lib/auth/session");
    const h = hashToken("token-a");
    expect(h).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("throws when SESSION_SECRET is missing and no override is passed", async () => {
    delete process.env.SESSION_SECRET;
    const { hashToken } = await import("@/lib/auth/session");
    expect(() => hashToken("token-a")).toThrow(/SESSION_SECRET/);
  });
});

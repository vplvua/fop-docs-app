import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockDb = {
  select: vi.fn(),
  insert: vi.fn(),
};

vi.mock("@/lib/db", () => ({ db: mockDb }));

vi.mock("@/lib/db/schema/settings", () => ({
  settings: { key: "key", value: "value", updatedAt: "updated_at" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: unknown[]) => args),
  sql: { raw: vi.fn() },
}));

function makeChain(rows: unknown[]) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(rows),
      }),
    }),
  };
}

describe("settings accessors", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("getContractPatterns returns parsed array", async () => {
    const patterns = [{ pattern: "test", description: "desc" }];
    mockDb.select.mockReturnValue(makeChain([{ value: patterns }]));

    const { getContractPatterns } = await import("@/lib/settings");
    const result = await getContractPatterns();
    expect(result).toEqual(patterns);
  });

  it("getContractPatterns returns empty array when no setting", async () => {
    mockDb.select.mockReturnValue(makeChain([]));

    const { getContractPatterns } = await import("@/lib/settings");
    const result = await getContractPatterns();
    expect(result).toEqual([]);
  });

  it("getSmsKeywords returns parsed array", async () => {
    mockDb.select.mockReturnValue(makeChain([{ value: ["смс", "sms"] }]));

    const { getSmsKeywords } = await import("@/lib/settings");
    const result = await getSmsKeywords();
    expect(result).toEqual(["смс", "sms"]);
  });

  it("getTransitEdrpouList returns parsed array", async () => {
    mockDb.select.mockReturnValue(makeChain([{ value: ["14360570"] }]));

    const { getTransitEdrpouList } = await import("@/lib/settings");
    const result = await getTransitEdrpouList();
    expect(result).toEqual(["14360570"]);
  });

  it("getPollingIntervals returns defaults when no settings", async () => {
    mockDb.select.mockReturnValue(makeChain([]));

    const { getPollingIntervals } = await import("@/lib/settings");
    const result = await getPollingIntervals();
    expect(result).toEqual({
      privatbankMinutes: 60,
      dubidocHours: 6,
      moeosbbSchedule: "first",
    });
  });
});

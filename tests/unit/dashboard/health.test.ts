import { describe, expect, it } from "vitest";

import { DASHBOARD_INTEGRATIONS, deriveHealth } from "@/lib/dashboard/health";
import type { IntegrationHealth } from "@/lib/db/schema/observability";

function makeRow(overrides: Partial<IntegrationHealth>): IntegrationHealth {
  return {
    service: "privatbank",
    lastSuccessAt: null,
    lastErrorAt: null,
    lastErrorMessage: null,
    updatedAt: new Date(),
    ...overrides,
  };
}

const earlier = new Date("2026-05-01T00:00:00Z");
const later = new Date("2026-05-02T00:00:00Z");

describe("deriveHealth", () => {
  it("returns unknown when there is no row", () => {
    expect(deriveHealth(undefined).state).toBe("unknown");
  });

  it("returns unknown when the integration has neither succeeded nor errored", () => {
    expect(deriveHealth(makeRow({})).state).toBe("unknown");
  });

  it("returns ok when only a success is recorded", () => {
    const result = deriveHealth(makeRow({ lastSuccessAt: later }));
    expect(result.state).toBe("ok");
    expect(result.lastSuccessAt).toEqual(later);
  });

  it("returns error when only an error is recorded", () => {
    const result = deriveHealth(makeRow({ lastErrorAt: later, lastErrorMessage: "boom" }));
    expect(result.state).toBe("error");
    expect(result.lastErrorMessage).toBe("boom");
  });

  it("returns error when the error is strictly newer than the success", () => {
    expect(deriveHealth(makeRow({ lastSuccessAt: earlier, lastErrorAt: later })).state).toBe(
      "error",
    );
  });

  it("returns ok when the success is newer than the error", () => {
    expect(deriveHealth(makeRow({ lastSuccessAt: later, lastErrorAt: earlier })).state).toBe("ok");
  });

  it("treats equal timestamps as ok (error must be strictly newer)", () => {
    expect(deriveHealth(makeRow({ lastSuccessAt: later, lastErrorAt: later })).state).toBe("ok");
  });
});

describe("DASHBOARD_INTEGRATIONS", () => {
  it("covers the three tracked services", () => {
    expect(DASHBOARD_INTEGRATIONS.map((i) => i.service)).toEqual([
      "privatbank",
      "dubidoc",
      "moeosbb",
    ]);
  });
});

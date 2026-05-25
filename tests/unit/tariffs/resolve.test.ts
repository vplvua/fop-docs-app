import { describe, expect, it } from "vitest";

import type { SmsPrice, Tariff } from "@/lib/db/schema/tariffs";
import { resolveAccessPrice, resolveSmsPrice } from "@/lib/tariffs/resolve";

function makeTariff(overrides: Partial<Tariff> & Pick<Tariff, "price" | "effectiveFrom">): Tariff {
  return {
    id: crypto.randomUUID(),
    apartmentsMin: 0,
    apartmentsMax: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeSmsPrice(
  overrides: Partial<SmsPrice> & Pick<SmsPrice, "price" | "effectiveFrom">,
): SmsPrice {
  return {
    id: crypto.randomUUID(),
    createdAt: new Date(),
    ...overrides,
  };
}

describe("resolveAccessPrice", () => {
  const client = { apartmentsCount: 70, accessPriceOverride: null };
  const catchAll = makeTariff({ price: "200.00", effectiveFrom: "2024-01-01" });

  it("returns override when set", () => {
    const c = { apartmentsCount: 70, accessPriceOverride: "500.00" };
    expect(resolveAccessPrice(c, [catchAll], "2025-06-15")).toBe("500.00");
  });

  it("returns catch-all when no ranged match", () => {
    expect(resolveAccessPrice(client, [catchAll], "2025-06-15")).toBe("200.00");
  });

  it("prefers ranged over catch-all", () => {
    const ranged = makeTariff({
      apartmentsMin: 50,
      apartmentsMax: 100,
      price: "300.00",
      effectiveFrom: "2024-01-01",
    });
    expect(resolveAccessPrice(client, [catchAll, ranged], "2025-06-15")).toBe("300.00");
  });

  it("prefers narrower range", () => {
    const wide = makeTariff({
      apartmentsMin: 10,
      apartmentsMax: 200,
      price: "250.00",
      effectiveFrom: "2024-01-01",
    });
    const narrow = makeTariff({
      apartmentsMin: 50,
      apartmentsMax: 100,
      price: "300.00",
      effectiveFrom: "2024-01-01",
    });
    expect(resolveAccessPrice(client, [catchAll, wide, narrow], "2025-06-15")).toBe("300.00");
  });

  it("picks latest effective_from among same-type rules", () => {
    const old = makeTariff({ price: "200.00", effectiveFrom: "2024-01-01" });
    const newer = makeTariff({ price: "250.00", effectiveFrom: "2025-01-01" });
    expect(resolveAccessPrice(client, [old, newer], "2025-06-15")).toBe("250.00");
  });

  it("respects payment date for effective_from filtering", () => {
    const old = makeTariff({ price: "200.00", effectiveFrom: "2024-01-01" });
    const future = makeTariff({ price: "250.00", effectiveFrom: "2025-01-01" });
    expect(resolveAccessPrice(client, [old, future], "2024-06-15")).toBe("200.00");
  });

  it("returns null when no tariffs exist", () => {
    expect(resolveAccessPrice(client, [], "2025-06-15")).toBeNull();
  });

  it("returns null when no rules are effective yet", () => {
    const future = makeTariff({ price: "200.00", effectiveFrom: "2030-01-01" });
    expect(resolveAccessPrice(client, [future], "2025-06-15")).toBeNull();
  });

  it("uses 0 for null apartmentsCount", () => {
    const c = { apartmentsCount: null, accessPriceOverride: null };
    expect(resolveAccessPrice(c, [catchAll], "2025-06-15")).toBe("200.00");
  });

  it("falls back to catch-all when apartments outside ranged", () => {
    const ranged = makeTariff({
      apartmentsMin: 50,
      apartmentsMax: 100,
      price: "300.00",
      effectiveFrom: "2024-01-01",
    });
    const bigClient = { apartmentsCount: 150, accessPriceOverride: null };
    expect(resolveAccessPrice(bigClient, [catchAll, ranged], "2025-06-15")).toBe("200.00");
  });
});

describe("resolveSmsPrice", () => {
  it("returns single price", () => {
    const p = makeSmsPrice({ price: "1.40", effectiveFrom: "2024-01-01" });
    expect(resolveSmsPrice([p], "2025-03-15")).toBe("1.40");
  });

  it("returns latest effective price", () => {
    const old = makeSmsPrice({ price: "1.40", effectiveFrom: "2024-01-01" });
    const newer = makeSmsPrice({ price: "1.80", effectiveFrom: "2025-01-01" });
    expect(resolveSmsPrice([old, newer], "2025-06-15")).toBe("1.80");
  });

  it("returns null when no price is effective", () => {
    const future = makeSmsPrice({ price: "1.40", effectiveFrom: "2025-01-01" });
    expect(resolveSmsPrice([future], "2024-06-15")).toBeNull();
  });

  it("returns null for empty array", () => {
    expect(resolveSmsPrice([], "2025-06-15")).toBeNull();
  });

  it("respects payment date boundary", () => {
    const old = makeSmsPrice({ price: "1.40", effectiveFrom: "2024-01-01" });
    const newer = makeSmsPrice({ price: "1.80", effectiveFrom: "2025-01-01" });
    expect(resolveSmsPrice([old, newer], "2024-12-31")).toBe("1.40");
  });
});

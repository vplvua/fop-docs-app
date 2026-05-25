import { describe, expect, it } from "vitest";

import { createSmsPriceSchema, createTariffSchema } from "@/lib/validation/tariffs";

describe("createTariffSchema", () => {
  const valid = { price: "200.00", effectiveFrom: "2024-01-01" };

  it("accepts valid input with defaults", () => {
    expect(createTariffSchema.safeParse(valid).success).toBe(true);
  });

  it("accepts ranged tariff", () => {
    const r = createTariffSchema.safeParse({
      ...valid,
      apartmentsMin: "50",
      apartmentsMax: "100",
    });
    expect(r.success).toBe(true);
  });

  it("rejects missing price", () => {
    const r = createTariffSchema.safeParse({ effectiveFrom: "2024-01-01" });
    expect(r.success).toBe(false);
  });

  it("rejects empty price", () => {
    const r = createTariffSchema.safeParse({ ...valid, price: "" });
    expect(r.success).toBe(false);
  });

  it("rejects invalid price format", () => {
    const r = createTariffSchema.safeParse({ ...valid, price: "abc" });
    expect(r.success).toBe(false);
  });

  it("rejects invalid date", () => {
    const r = createTariffSchema.safeParse({ ...valid, effectiveFrom: "nope" });
    expect(r.success).toBe(false);
  });

  it("rejects missing effectiveFrom", () => {
    const r = createTariffSchema.safeParse({ price: "200" });
    expect(r.success).toBe(false);
  });

  it("accepts optional apartmentsMax as undefined", () => {
    const r = createTariffSchema.safeParse(valid);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.apartmentsMax).toBeUndefined();
    }
  });
});

describe("createSmsPriceSchema", () => {
  const valid = { price: "1.40", effectiveFrom: "2024-01-01" };

  it("accepts valid input", () => {
    expect(createSmsPriceSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects missing price", () => {
    const r = createSmsPriceSchema.safeParse({ effectiveFrom: "2024-01-01" });
    expect(r.success).toBe(false);
  });

  it("rejects invalid date", () => {
    const r = createSmsPriceSchema.safeParse({ ...valid, effectiveFrom: "bad" });
    expect(r.success).toBe(false);
  });

  it("rejects invalid price format", () => {
    const r = createSmsPriceSchema.safeParse({ ...valid, price: "1.234" });
    expect(r.success).toBe(false);
  });
});

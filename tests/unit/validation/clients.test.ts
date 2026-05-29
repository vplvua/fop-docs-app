import { describe, expect, it } from "vitest";

import { createClientSchema, updateClientSchema } from "@/lib/validation/clients";

describe("createClientSchema", () => {
  const valid = { name: "ТОВ Тест", legalId: "12345678", email: "a@b.com" };

  it("accepts valid input with required fields only", () => {
    expect(createClientSchema.safeParse(valid).success).toBe(true);
  });

  it("accepts 10-digit РНОКПП", () => {
    expect(createClientSchema.safeParse({ ...valid, legalId: "1234567890" }).success).toBe(true);
  });

  it("rejects 5-digit legal_id", () => {
    const r = createClientSchema.safeParse({ ...valid, legalId: "12345" });
    expect(r.success).toBe(false);
  });

  it("rejects legal_id with letters", () => {
    const r = createClientSchema.safeParse({ ...valid, legalId: "1234ABCD" });
    expect(r.success).toBe(false);
  });

  it("rejects empty legal_id", () => {
    const r = createClientSchema.safeParse({ ...valid, legalId: "" });
    expect(r.success).toBe(false);
  });

  it("rejects invalid email", () => {
    const r = createClientSchema.safeParse({ ...valid, email: "not-an-email" });
    expect(r.success).toBe(false);
  });

  it("rejects empty name", () => {
    const r = createClientSchema.safeParse({ ...valid, name: "" });
    expect(r.success).toBe(false);
  });

  it("accepts valid apartmentsCount", () => {
    const r = createClientSchema.safeParse({ ...valid, apartmentsCount: "50" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.apartmentsCount).toBe(50);
  });

  it("rejects apartmentsCount < 1", () => {
    const r = createClientSchema.safeParse({ ...valid, apartmentsCount: "0" });
    expect(r.success).toBe(false);
  });

  it("accepts valid accessPriceOverride", () => {
    const r = createClientSchema.safeParse({ ...valid, accessPriceOverride: "300.50" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.accessPriceOverride).toBe("300.50");
  });

  it("rejects accessPriceOverride with 3 decimals", () => {
    const r = createClientSchema.safeParse({ ...valid, accessPriceOverride: "100.123" });
    expect(r.success).toBe(false);
  });

  it("coerces an empty accessPriceOverride to null (cleared field)", () => {
    const r = createClientSchema.safeParse({ ...valid, accessPriceOverride: "" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.accessPriceOverride).toBeNull();
  });

  it("coerces an empty apartmentsCount to null (cleared field)", () => {
    const r = createClientSchema.safeParse({ ...valid, apartmentsCount: "" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.apartmentsCount).toBeNull();
  });

  it("coerces an empty moeosbbUserId to null (cleared field)", () => {
    const r = createClientSchema.safeParse({ ...valid, moeosbbUserId: "" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.moeosbbUserId).toBeNull();
  });

  it("accepts valid edoProvider", () => {
    expect(
      createClientSchema.safeParse({ ...valid, edoProvider: "vchasno_external" }).success,
    ).toBe(true);
  });

  it("rejects invalid edoProvider", () => {
    expect(createClientSchema.safeParse({ ...valid, edoProvider: "fax" }).success).toBe(false);
  });

  it("accepts valid moeosbbUserId", () => {
    const r = createClientSchema.safeParse({ ...valid, moeosbbUserId: "42" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.moeosbbUserId).toBe(42);
  });

  it("rejects moeosbbUserId < 1", () => {
    expect(createClientSchema.safeParse({ ...valid, moeosbbUserId: "0" }).success).toBe(false);
  });
});

describe("updateClientSchema", () => {
  it("accepts update with only id", () => {
    const r = updateClientSchema.safeParse({ id: "550e8400-e29b-41d4-a716-446655440000" });
    expect(r.success).toBe(true);
  });

  it("accepts partial update", () => {
    const r = updateClientSchema.safeParse({
      id: "550e8400-e29b-41d4-a716-446655440000",
      name: "Нова назва",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.name).toBe("Нова назва");
  });

  it("rejects invalid id", () => {
    expect(updateClientSchema.safeParse({ id: "not-uuid" }).success).toBe(false);
  });

  it("still validates fields when present", () => {
    const r = updateClientSchema.safeParse({
      id: "550e8400-e29b-41d4-a716-446655440000",
      legalId: "123",
    });
    expect(r.success).toBe(false);
  });

  it("accepts an empty accessPriceOverride alongside other edited fields", () => {
    const r = updateClientSchema.safeParse({
      id: "550e8400-e29b-41d4-a716-446655440000",
      apartmentsCount: "139",
      accessPriceOverride: "",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.apartmentsCount).toBe(139);
      expect(r.data.accessPriceOverride).toBeNull();
    }
  });
});

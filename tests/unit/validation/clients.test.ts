import { describe, expect, it } from "vitest";

import {
  clientCardFormSchema,
  clientUpdateSchema,
  createClientSchema,
  updateClientSchema,
} from "@/lib/validation/clients";

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

  it("trims and keeps a non-empty short name", () => {
    const r = createClientSchema.safeParse({ ...valid, shortName: "  Молодіжний  " });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.shortName).toBe("Молодіжний");
  });

  it("normalizes an empty short name to null", () => {
    const r = createClientSchema.safeParse({ ...valid, shortName: "" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.shortName).toBeNull();
  });

  it("normalizes a whitespace-only short name to null", () => {
    const r = createClientSchema.safeParse({ ...valid, shortName: "   " });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.shortName).toBeNull();
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

  it("normalizes a cleared short name to null", () => {
    const r = updateClientSchema.safeParse({
      id: "550e8400-e29b-41d4-a716-446655440000",
      shortName: "",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.shortName).toBeNull();
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

describe("clientUpdateSchema (partial card update)", () => {
  const id = "550e8400-e29b-41d4-a716-446655440000";

  it("accepts a partial update with only one field (untouched fields absent)", () => {
    const r = clientUpdateSchema.safeParse({ id, name: "ОСББ Сонячне" });
    expect(r.success).toBe(true);
  });

  it("does not block on an empty required email (incomplete client)", () => {
    const r = clientUpdateSchema.safeParse({ id, name: "ОСББ Сонячне", email: "" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.email).toBe("");
  });

  it("allows clearing a previously-set legalId to empty", () => {
    const r = clientUpdateSchema.safeParse({ id, legalId: "" });
    expect(r.success).toBe(true);
  });

  it("still rejects a malformed non-empty email", () => {
    const r = clientUpdateSchema.safeParse({ id, email: "not-an-email" });
    expect(r.success).toBe(false);
  });

  it("still rejects a malformed non-empty legalId", () => {
    const r = clientUpdateSchema.safeParse({ id, legalId: "123" });
    expect(r.success).toBe(false);
  });
});

describe("clientCardFormSchema (client-side, presence never blocks)", () => {
  const empty = {
    name: "",
    shortName: "",
    legalId: "",
    email: "",
    address: "",
    bankName: "",
    bankAccount: "",
    apartmentsCount: "",
    accessPriceOverride: "",
    edoProvider: "dubidoc" as const,
    moeosbbUserId: "",
  };

  it("accepts an all-empty form (validation never blocks on missing values)", () => {
    expect(clientCardFormSchema.safeParse(empty).success).toBe(true);
  });

  it("rejects a malformed email when filled", () => {
    const r = clientCardFormSchema.safeParse({ ...empty, email: "nope" });
    expect(r.success).toBe(false);
  });

  it("accepts a valid email and legalId when filled", () => {
    const r = clientCardFormSchema.safeParse({ ...empty, email: "a@b.com", legalId: "12345678" });
    expect(r.success).toBe(true);
  });

  it("rejects a non-numeric apartmentsCount", () => {
    const r = clientCardFormSchema.safeParse({ ...empty, apartmentsCount: "ten" });
    expect(r.success).toBe(false);
  });
});

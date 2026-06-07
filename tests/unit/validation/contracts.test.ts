import { describe, expect, it } from "vitest";

import {
  contractFormSchema,
  createContractSchema,
  updateContractSchema,
} from "@/lib/validation/contracts";

describe("createContractSchema", () => {
  const valid = {
    clientId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    number: "556770",
    signedDate: "2025-01-15",
  };

  it("accepts valid input with required fields only", () => {
    expect(createContractSchema.safeParse(valid).success).toBe(true);
  });

  it("accepts all optional fields", () => {
    const full = {
      ...valid,
      isStandard: false,
      fileUrl: "https://example.com/contract.pdf",
      notes: "Спеціальні умови",
    };
    expect(createContractSchema.safeParse(full).success).toBe(true);
  });

  it("rejects empty number", () => {
    const r = createContractSchema.safeParse({ ...valid, number: "" });
    expect(r.success).toBe(false);
  });

  it("rejects missing signedDate", () => {
    const r = createContractSchema.safeParse({ ...valid, signedDate: "" });
    expect(r.success).toBe(false);
  });

  it("rejects invalid date format", () => {
    const r = createContractSchema.safeParse({ ...valid, signedDate: "not-a-date" });
    expect(r.success).toBe(false);
  });

  it("rejects invalid clientId (not uuid)", () => {
    const r = createContractSchema.safeParse({ ...valid, clientId: "bad-id" });
    expect(r.success).toBe(false);
  });

  it("rejects missing clientId", () => {
    const { clientId: _, ...noClient } = valid;
    const r = createContractSchema.safeParse(noClient);
    expect(r.success).toBe(false);
  });

  it("accepts empty string for fileUrl (treated as no URL)", () => {
    const r = createContractSchema.safeParse({ ...valid, fileUrl: "" });
    expect(r.success).toBe(true);
  });

  it("rejects invalid URL for fileUrl", () => {
    const r = createContractSchema.safeParse({ ...valid, fileUrl: "not-a-url" });
    expect(r.success).toBe(false);
  });

  it("accepts undefined optional fields", () => {
    const r = createContractSchema.safeParse({
      ...valid,
      isStandard: undefined,
      fileUrl: undefined,
      notes: undefined,
    });
    expect(r.success).toBe(true);
  });
});

describe("updateContractSchema", () => {
  const validId = { id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11" };

  it("accepts id-only (no field changes)", () => {
    expect(updateContractSchema.safeParse(validId).success).toBe(true);
  });

  it("accepts partial update with number", () => {
    const r = updateContractSchema.safeParse({ ...validId, number: "556771" });
    expect(r.success).toBe(true);
  });

  it("rejects invalid id", () => {
    const r = updateContractSchema.safeParse({ id: "bad" });
    expect(r.success).toBe(false);
  });

  it("rejects empty number when provided", () => {
    const r = updateContractSchema.safeParse({ ...validId, number: "" });
    expect(r.success).toBe(false);
  });

  it("rejects invalid signedDate when provided", () => {
    const r = updateContractSchema.safeParse({ ...validId, signedDate: "nope" });
    expect(r.success).toBe(false);
  });

  it("accepts valid signedDate", () => {
    const r = updateContractSchema.safeParse({ ...validId, signedDate: "2025-06-01" });
    expect(r.success).toBe(true);
  });
});

describe("contractFormSchema (client-side card form)", () => {
  const valid = {
    number: "123",
    signedDate: "2026-01-15",
    isStandard: true,
    fileUrl: "",
    notes: "",
  };

  it("accepts a valid contract form", () => {
    expect(contractFormSchema.safeParse(valid).success).toBe(true);
  });

  it("requires a number", () => {
    expect(contractFormSchema.safeParse({ ...valid, number: "" }).success).toBe(false);
  });

  it("requires a signedDate", () => {
    expect(contractFormSchema.safeParse({ ...valid, signedDate: "" }).success).toBe(false);
  });

  it("rejects a malformed signedDate", () => {
    expect(contractFormSchema.safeParse({ ...valid, signedDate: "15.01.2026" }).success).toBe(
      false,
    );
  });

  it("accepts an empty fileUrl but rejects a malformed one", () => {
    expect(contractFormSchema.safeParse({ ...valid, fileUrl: "" }).success).toBe(true);
    expect(contractFormSchema.safeParse({ ...valid, fileUrl: "not-a-url" }).success).toBe(false);
  });
});

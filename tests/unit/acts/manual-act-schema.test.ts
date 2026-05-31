import { describe, expect, it } from "vitest";

import { manualActEditSchema, manualActFormSchema } from "@/lib/acts/manual-act-schema";

const valid = {
  clientId: "11111111-1111-4111-8111-111111111111",
  periodYear: 2025,
  periodMonth: 12,
  serviceType: "access" as const,
  quantity: "1",
  unitPrice: "200.00",
  amount: "200.00",
};

describe("manualActFormSchema", () => {
  it("accepts a valid access act", () => {
    const result = manualActFormSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.bankLabel).toBeNull();
      expect(result.data.paymentDate).toBeNull();
    }
  });

  it("coerces string month/year from form data", () => {
    const result = manualActFormSchema.safeParse({
      ...valid,
      periodMonth: "12",
      periodYear: "2025",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.periodMonth).toBe(12);
      expect(result.data.periodYear).toBe(2025);
    }
  });

  it("normalises empty bankLabel / paymentDate to null", () => {
    const result = manualActFormSchema.safeParse({ ...valid, bankLabel: "", paymentDate: "" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.bankLabel).toBeNull();
      expect(result.data.paymentDate).toBeNull();
    }
  });

  it("keeps a provided bankLabel and paymentDate", () => {
    const result = manualActFormSchema.safeParse({
      ...valid,
      bankLabel: "Монобанк",
      paymentDate: "2026-01-10",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.bankLabel).toBe("Монобанк");
      expect(result.data.paymentDate).toBe("2026-01-10");
    }
  });

  it("rejects a non-positive quantity", () => {
    expect(manualActFormSchema.safeParse({ ...valid, quantity: "0" }).success).toBe(false);
  });

  it("rejects a non-positive amount", () => {
    expect(manualActFormSchema.safeParse({ ...valid, amount: "0" }).success).toBe(false);
  });

  it("rejects an unknown service type", () => {
    expect(manualActFormSchema.safeParse({ ...valid, serviceType: "internet" }).success).toBe(
      false,
    );
  });

  it("rejects a month outside 1-12", () => {
    expect(manualActFormSchema.safeParse({ ...valid, periodMonth: 13 }).success).toBe(false);
    expect(manualActFormSchema.safeParse({ ...valid, periodMonth: 0 }).success).toBe(false);
  });

  it("rejects a malformed amount", () => {
    expect(manualActFormSchema.safeParse({ ...valid, amount: "12.345" }).success).toBe(false);
    expect(manualActFormSchema.safeParse({ ...valid, amount: "abc" }).success).toBe(false);
  });

  it("rejects a malformed payment date", () => {
    expect(manualActFormSchema.safeParse({ ...valid, paymentDate: "10-01-2026" }).success).toBe(
      false,
    );
  });
});

const validEdit = {
  serviceType: "access" as const,
  quantity: "1",
  unitPrice: "200.00",
  amount: "200.00",
};

describe("manualActEditSchema", () => {
  it("accepts valid value fields and normalises optionals to null", () => {
    const result = manualActEditSchema.safeParse(validEdit);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.bankLabel).toBeNull();
      expect(result.data.paymentDate).toBeNull();
    }
  });

  it("keeps a provided bankLabel and paymentDate", () => {
    const result = manualActEditSchema.safeParse({
      ...validEdit,
      bankLabel: "Монобанк",
      paymentDate: "2026-01-10",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.bankLabel).toBe("Монобанк");
      expect(result.data.paymentDate).toBe("2026-01-10");
    }
  });

  it("rejects a non-positive amount or quantity", () => {
    expect(manualActEditSchema.safeParse({ ...validEdit, amount: "0" }).success).toBe(false);
    expect(manualActEditSchema.safeParse({ ...validEdit, quantity: "0" }).success).toBe(false);
  });

  it("rejects a malformed amount and a malformed date", () => {
    expect(manualActEditSchema.safeParse({ ...validEdit, amount: "12.345" }).success).toBe(false);
    expect(manualActEditSchema.safeParse({ ...validEdit, paymentDate: "10-01-2026" }).success).toBe(
      false,
    );
  });

  it("rejects an unknown service type", () => {
    expect(manualActEditSchema.safeParse({ ...validEdit, serviceType: "internet" }).success).toBe(
      false,
    );
  });
});

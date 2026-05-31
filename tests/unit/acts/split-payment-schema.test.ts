import { describe, expect, it } from "vitest";

import {
  reconcilesExactly,
  splitPaymentFormSchema,
  type SplitLineInput,
} from "@/lib/acts/split-payment-schema";

const line = (over: Partial<SplitLineInput> = {}): SplitLineInput => ({
  clientId: crypto.randomUUID(),
  periodYear: 2026,
  periodMonth: 3,
  serviceType: "access",
  quantity: "1",
  unitPrice: "1000.00",
  amount: "1000.00",
  ...over,
});

describe("reconcilesExactly", () => {
  it("accepts the Великошпанівське bundle: 6460 = 1000 + 5460", () => {
    expect(reconcilesExactly("6460.00", ["1000.00", "5460.00"])).toBe(true);
  });

  it("accepts a three-way split summing to the payment", () => {
    expect(reconcilesExactly("600.00", ["200.00", "150.50", "249.50"])).toBe(true);
  });

  it("rejects an off-by-0.01 split", () => {
    expect(reconcilesExactly("6460.00", ["1000.00", "5459.99"])).toBe(false);
  });

  it("rejects an over-allocation", () => {
    expect(reconcilesExactly("1000.00", ["1000.00", "0.01"])).toBe(false);
  });

  it("does not drift on fractional kopiykas (0.10 + 0.20 == 0.30)", () => {
    expect(reconcilesExactly("0.30", ["0.10", "0.20"])).toBe(true);
  });

  it("treats a single line equal to the amount as reconciled", () => {
    expect(reconcilesExactly("250.00", ["250.00"])).toBe(true);
  });
});

describe("splitPaymentFormSchema", () => {
  it("parses a valid two-line split", () => {
    const result = splitPaymentFormSchema.safeParse({
      paymentId: crypto.randomUUID(),
      lines: [line({ amount: "1000.00" }), line({ serviceType: "sms", amount: "5460.00" })],
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty line list", () => {
    const result = splitPaymentFormSchema.safeParse({ paymentId: crypto.randomUUID(), lines: [] });
    expect(result.success).toBe(false);
  });

  it("rejects a non-positive amount", () => {
    const result = splitPaymentFormSchema.safeParse({
      paymentId: crypto.randomUUID(),
      lines: [line({ amount: "0" })],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a malformed amount (3 fraction digits)", () => {
    const result = splitPaymentFormSchema.safeParse({
      paymentId: crypto.randomUUID(),
      lines: [line({ amount: "10.005" })],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a non-uuid paymentId", () => {
    const result = splitPaymentFormSchema.safeParse({ paymentId: "nope", lines: [line()] });
    expect(result.success).toBe(false);
  });
});

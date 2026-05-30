import { describe, expect, it } from "vitest";

import {
  parseSmsQuantity,
  resolveAccessQuantity,
  resolveQuantity,
  resolveSmsQuantity,
} from "@/lib/classification/resolve-quantity";

const monthly = { annualPaidMonths: 10, hasOverride: false };
const overridden = { annualPaidMonths: 10, hasOverride: true };

describe("resolveAccessQuantity", () => {
  it("returns quantity when evenly divisible (monthly)", () => {
    expect(resolveAccessQuantity("600.00", "200.00", monthly)).toEqual({
      status: "ok",
      quantity: "3",
      quantityUnit: "міс.",
      billingPeriod: "monthly",
    });
  });

  it("recognises a one-shot yearly payment as 12 months (annual wins over '10 months')", () => {
    expect(resolveAccessQuantity("2000.00", "200.00", monthly)).toEqual({
      status: "ok",
      quantity: "12",
      quantityUnit: "міс.",
      billingPeriod: "annual",
    });
  });

  it("routes amounts above the annual price to review", () => {
    expect(resolveAccessQuantity("2400.00", "200.00", monthly)).toEqual({
      status: "mismatch",
      reason: "amount_mismatch",
    });
  });

  it("never applies the annual discount to override clients (2000 → 10 monthly)", () => {
    expect(resolveAccessQuantity("2000.00", "200.00", overridden)).toEqual({
      status: "ok",
      quantity: "10",
      quantityUnit: "міс.",
      billingPeriod: "monthly",
    });
  });

  it("honours a configurable annualPaidMonths (N = 11 → 2200 is the year)", () => {
    expect(
      resolveAccessQuantity("2200.00", "200.00", { annualPaidMonths: 11, hasOverride: false }),
    ).toEqual({
      status: "ok",
      quantity: "12",
      quantityUnit: "міс.",
      billingPeriod: "annual",
    });
    // 2000 = 10 months, still below the year → monthly
    expect(
      resolveAccessQuantity("2000.00", "200.00", { annualPaidMonths: 11, hasOverride: false }),
    ).toEqual({
      status: "ok",
      quantity: "10",
      quantityUnit: "міс.",
      billingPeriod: "monthly",
    });
  });

  it("returns mismatch when not divisible", () => {
    expect(resolveAccessQuantity("550.00", "200.00", monthly)).toEqual({
      status: "mismatch",
      reason: "amount_mismatch",
    });
  });

  it("returns mismatch for zero price", () => {
    expect(resolveAccessQuantity("200.00", "0", monthly)).toEqual({
      status: "mismatch",
      reason: "amount_mismatch",
    });
  });
});

describe("parseSmsQuantity", () => {
  it("parses 'у кількості N'", () => {
    expect(parseSmsQuantity("Оплата СМС у кількості 100")).toBe(100);
  });

  it("parses 'N шт'", () => {
    expect(parseSmsQuantity("200 шт СМС")).toBe(200);
  });

  it("returns null for unparseable", () => {
    expect(parseSmsQuantity("Оплата за послуги")).toBeNull();
  });
});

describe("resolveSmsQuantity", () => {
  it("validates quantity × price = amount", () => {
    expect(resolveSmsQuantity("140.00", "1.40", "СМС у кількості 100")).toEqual({
      status: "ok",
      quantity: "100",
      quantityUnit: "шт.",
      billingPeriod: "monthly",
    });
  });

  it("returns mismatch when quantity × price ≠ amount", () => {
    expect(resolveSmsQuantity("150.00", "1.40", "СМС у кількості 100")).toEqual({
      status: "mismatch",
      reason: "sms_quantity_mismatch",
    });
  });

  it("returns mismatch when quantity not parseable", () => {
    expect(resolveSmsQuantity("140.00", "1.40", "Оплата за послуги")).toEqual({
      status: "mismatch",
      reason: "sms_quantity_mismatch",
    });
  });
});

describe("resolveQuantity", () => {
  it("delegates to access for access type", () => {
    const result = resolveQuantity("access", "400.00", "200.00", "", monthly);
    expect(result).toEqual({
      status: "ok",
      quantity: "2",
      quantityUnit: "міс.",
      billingPeriod: "monthly",
    });
  });

  it("delegates to sms for sms type (access options ignored)", () => {
    const result = resolveQuantity("sms", "140.00", "1.40", "у кількості 100", monthly);
    expect(result).toEqual({
      status: "ok",
      quantity: "100",
      quantityUnit: "шт.",
      billingPeriod: "monthly",
    });
  });
});

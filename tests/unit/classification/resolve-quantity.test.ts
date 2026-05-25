import { describe, expect, it } from "vitest";

import {
  parseSmsQuantity,
  resolveAccessQuantity,
  resolveQuantity,
  resolveSmsQuantity,
} from "@/lib/classification/resolve-quantity";

describe("resolveAccessQuantity", () => {
  it("returns quantity when evenly divisible", () => {
    expect(resolveAccessQuantity("600.00", "200.00")).toEqual({
      status: "ok",
      quantity: "3",
      quantityUnit: "міс.",
    });
  });

  it("returns mismatch when not divisible", () => {
    expect(resolveAccessQuantity("550.00", "200.00")).toEqual({
      status: "mismatch",
      reason: "amount_mismatch",
    });
  });

  it("returns mismatch for zero price", () => {
    expect(resolveAccessQuantity("200.00", "0")).toEqual({
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
    const result = resolveQuantity("access", "400.00", "200.00", "");
    expect(result).toEqual({ status: "ok", quantity: "2", quantityUnit: "міс." });
  });

  it("delegates to sms for sms type", () => {
    const result = resolveQuantity("sms", "140.00", "1.40", "у кількості 100");
    expect(result).toEqual({ status: "ok", quantity: "100", quantityUnit: "шт." });
  });
});

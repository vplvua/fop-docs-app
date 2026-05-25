import { describe, expect, it } from "vitest";

describe("regex pattern validation", () => {
  it("valid regex compiles", () => {
    expect(() => new RegExp("договір\\s*[№#]\\s*(\\d{5,6})", "u")).not.toThrow();
  });

  it("invalid regex throws", () => {
    const broken = ["[invalid", "("].join("");
    expect(() => new RegExp(broken, "u")).toThrow();
  });

  it("complex pattern with lookahead compiles", () => {
    expect(() => new RegExp("[№#N]\\s*(\\d{5,6})(?!\\d)", "u")).not.toThrow();
  });
});

describe("EDRPOU validation", () => {
  const edrpouRegex = /^\d{8}$/u;

  it("accepts 8-digit EDRPOU", () => {
    expect(edrpouRegex.test("14360570")).toBe(true);
  });

  it("rejects 5-digit string", () => {
    expect(edrpouRegex.test("12345")).toBe(false);
  });

  it("rejects 10-digit string", () => {
    expect(edrpouRegex.test("1234567890")).toBe(false);
  });

  it("rejects non-digits", () => {
    expect(edrpouRegex.test("1234ABCD")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(edrpouRegex.test("")).toBe(false);
  });
});

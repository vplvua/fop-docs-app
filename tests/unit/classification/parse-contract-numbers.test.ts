import { describe, expect, it } from "vitest";

import { parseContractNumbers } from "@/lib/classification/parse-contract-numbers";
import type { PatternEntry } from "@/lib/settings";

const patterns: PatternEntry[] = [
  { pattern: "договір\\s*[№#]\\s*(\\d+)", description: "договір №NNNNNN" },
  { pattern: "дог\\.?\\s*(\\d{6})", description: "дог NNNNNN" },
];

describe("parseContractNumbers", () => {
  it("extracts a single contract number", () => {
    const result = parseContractNumbers("Оплата по договір №556770", patterns);
    expect(result).toEqual(["556770"]);
  });

  it("deduplicates when multiple patterns match the same number", () => {
    const result = parseContractNumbers("Оплата по договір №556770, дог 556770", patterns);
    expect(result).toEqual(["556770"]);
  });

  it("returns empty array when no patterns match", () => {
    const result = parseContractNumbers("Поповнення рахунку", patterns);
    expect(result).toEqual([]);
  });

  it("returns multiple different numbers", () => {
    const result = parseContractNumbers("договір №556770 та договір №556771", patterns);
    expect(result).toEqual(["556770", "556771"]);
  });

  it("handles empty patterns array", () => {
    const result = parseContractNumbers("договір №556770", []);
    expect(result).toEqual([]);
  });

  it("skips invalid regex patterns gracefully", () => {
    const bad: PatternEntry[] = [{ pattern: "[invalid(", description: "broken" }, ...patterns];
    const result = parseContractNumbers("договір №556770", bad);
    expect(result).toEqual(["556770"]);
  });
});

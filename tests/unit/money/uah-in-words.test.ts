import { describe, expect, it } from "vitest";

import { uahInWords } from "@/lib/money/uah-in-words";

describe("uahInWords", () => {
  it("renders the sample amounts", () => {
    expect(uahInWords("200.00")).toBe("двісті гривень 00 коп.");
    expect(uahInWords("2000.00")).toBe("дві тисячі гривень 00 коп.");
  });

  it("declines гривня by the feminine rules", () => {
    expect(uahInWords(1)).toBe("одна гривня 00 коп.");
    expect(uahInWords(2)).toBe("дві гривні 00 коп.");
    expect(uahInWords(5)).toBe("п'ять гривень 00 коп.");
    expect(uahInWords(21)).toBe("двадцять одна гривня 00 коп.");
    expect(uahInWords(152)).toBe("сто п'ятдесят дві гривні 00 коп.");
    expect(uahInWords(11)).toBe("одинадцять гривень 00 коп.");
  });

  it("handles thousands with feminine тисяча", () => {
    expect(uahInWords(1000)).toBe("одна тисяча гривень 00 коп.");
    expect(uahInWords(5000)).toBe("п'ять тисяч гривень 00 коп.");
    expect(uahInWords(2500)).toBe("дві тисячі п'ятсот гривень 00 коп.");
  });

  it("renders kopecks as two digits", () => {
    expect(uahInWords("200.50")).toBe("двісті гривень 50 коп.");
    expect(uahInWords("0.05")).toBe("нуль гривень 05 коп.");
    expect(uahInWords("1.01")).toBe("одна гривня 01 коп.");
  });

  it("renders zero", () => {
    expect(uahInWords(0)).toBe("нуль гривень 00 коп.");
  });

  it("rejects invalid amounts", () => {
    expect(() => uahInWords("abc")).toThrow();
    expect(() => uahInWords(-5)).toThrow();
  });
});

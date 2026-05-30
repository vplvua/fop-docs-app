import { describe, expect, it } from "vitest";

import { extractMonth, extractYear, formatActNumber } from "@/lib/acts/numbering";

describe("extractMonth", () => {
  it("returns 4 for April date", () => {
    expect(extractMonth("2026-04-30")).toBe(4);
  });

  it("returns 1 for January date", () => {
    expect(extractMonth("2026-01-31")).toBe(1);
  });

  it("returns 12 for December date", () => {
    expect(extractMonth("2026-12-31")).toBe(12);
  });
});

describe("extractYear", () => {
  it("returns the year from a YYYY-MM-DD string", () => {
    expect(extractYear("2026-04-30")).toBe(2026);
    expect(extractYear("2024-12-31")).toBe(2024);
  });
});

describe("formatActNumber", () => {
  it("returns MM/YYYY (zero-padded month) for the first act in a month", () => {
    expect(formatActNumber(4, 2026, 0)).toBe("04/2026");
  });

  it("returns MM/YYYY/2 for the second act", () => {
    expect(formatActNumber(4, 2026, 1)).toBe("04/2026/2");
  });

  it("returns MM/YYYY/3 for the third act", () => {
    expect(formatActNumber(4, 2026, 2)).toBe("04/2026/3");
  });

  it("does not pad a two-digit month", () => {
    expect(formatActNumber(12, 2026, 0)).toBe("12/2026");
  });
});

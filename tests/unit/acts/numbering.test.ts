import { describe, expect, it } from "vitest";

import { extractMonth, formatActNumber } from "@/lib/acts/numbering";

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

describe("formatActNumber", () => {
  it("returns №M for first act in month", () => {
    expect(formatActNumber(4, 0)).toBe("№4");
  });

  it("returns №M/2 for second act", () => {
    expect(formatActNumber(4, 1)).toBe("№4/2");
  });

  it("returns №M/3 for third act", () => {
    expect(formatActNumber(4, 2)).toBe("№4/3");
  });

  it("handles month 12", () => {
    expect(formatActNumber(12, 0)).toBe("№12");
  });
});

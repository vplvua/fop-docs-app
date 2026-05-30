import { describe, expect, it } from "vitest";

import {
  extractMonth,
  extractYear,
  formatActNumber,
  reformatActNumber,
} from "@/lib/acts/numbering";

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

describe("reformatActNumber", () => {
  it("migrates legacy №M to MM/YYYY", () => {
    expect(reformatActNumber("№5", "2026-05-31")).toBe("05/2026");
    expect(reformatActNumber("№4", "2026-04-30")).toBe("04/2026");
  });

  it("migrates legacy №M/N preserving the ordinal", () => {
    expect(reformatActNumber("№5/2", "2026-05-31")).toBe("05/2026/2");
    expect(reformatActNumber("№5/3", "2026-05-31")).toBe("05/2026/3");
  });

  it("is idempotent for already-new numbers", () => {
    expect(reformatActNumber("05/2026", "2026-05-31")).toBe("05/2026");
    expect(reformatActNumber("05/2026/2", "2026-05-31")).toBe("05/2026/2");
  });

  it("returns unrecognised values unchanged", () => {
    expect(reformatActNumber("weird-1", "2026-05-31")).toBe("weird-1");
  });
});

import { describe, it, expect } from "vitest";

import {
  isPeriodPreset,
  isValidIsoDate,
  resolveDateRange,
  resolvePeriod,
  type PeriodPreset,
} from "@/lib/data-tables/date-ranges";

/**
 * Build an instant that lands on the given Kyiv calendar day. 09:00 UTC is
 * safely mid-day in Kyiv (UTC+2/+3) year-round, so the civil date never slips.
 */
function kyivDay(date: string): Date {
  return new Date(`${date}T09:00:00Z`);
}

describe("resolvePeriod", () => {
  // Anchor: Wednesday 2026-05-13 (Q2, May has 31 days).
  const now = kyivDay("2026-05-13");

  const cases: Array<[PeriodPreset, string, string]> = [
    ["today", "2026-05-13", "2026-05-13"],
    ["this_week", "2026-05-11", "2026-05-17"], // Mon..Sun
    ["last_week", "2026-05-04", "2026-05-10"],
    ["this_month", "2026-05-01", "2026-05-31"],
    ["last_month", "2026-04-01", "2026-04-30"], // April has 30 days
    ["this_quarter", "2026-04-01", "2026-06-30"], // Q2
    ["last_quarter", "2026-01-01", "2026-03-31"], // Q1
  ];

  it.each(cases)("%s → %s..%s", (preset, from, to) => {
    expect(resolvePeriod(preset, now)).toEqual({ from, to });
  });

  it("anchors 'today' on the Kyiv calendar day, not UTC", () => {
    // 2026-05-13 23:30 UTC is already 2026-05-14 in Kyiv (UTC+3 in summer).
    expect(resolvePeriod("today", new Date("2026-05-13T23:30:00Z"))).toEqual({
      from: "2026-05-14",
      to: "2026-05-14",
    });
  });

  it("week-start-Monday: a Monday anchor is its own week start", () => {
    expect(resolvePeriod("this_week", kyivDay("2026-05-11"))).toEqual({
      from: "2026-05-11",
      to: "2026-05-17",
    });
  });

  it("week-start-Monday: a Sunday anchor closes the current week", () => {
    expect(resolvePeriod("this_week", kyivDay("2026-05-17"))).toEqual({
      from: "2026-05-11",
      to: "2026-05-17",
    });
  });

  it("week rollover across a month/year boundary", () => {
    // Thursday 2027-01-01 → week Mon 2026-12-28 .. Sun 2027-01-03.
    expect(resolvePeriod("this_week", kyivDay("2027-01-01"))).toEqual({
      from: "2026-12-28",
      to: "2027-01-03",
    });
  });

  it("last_month rolls year back from January", () => {
    expect(resolvePeriod("last_month", kyivDay("2026-01-15"))).toEqual({
      from: "2025-12-01",
      to: "2025-12-31",
    });
  });

  it("last_quarter rolls year back from Q1", () => {
    expect(resolvePeriod("last_quarter", kyivDay("2026-02-10"))).toEqual({
      from: "2025-10-01",
      to: "2025-12-31",
    });
  });

  it("this_quarter for Q4", () => {
    expect(resolvePeriod("this_quarter", kyivDay("2026-11-20"))).toEqual({
      from: "2026-10-01",
      to: "2026-12-31",
    });
  });

  it("February length in a non-leap year", () => {
    expect(resolvePeriod("this_month", kyivDay("2026-02-10"))).toEqual({
      from: "2026-02-01",
      to: "2026-02-28",
    });
  });

  it("February length in a leap year", () => {
    expect(resolvePeriod("this_month", kyivDay("2024-02-10"))).toEqual({
      from: "2024-02-01",
      to: "2024-02-29",
    });
  });
});

describe("isPeriodPreset", () => {
  it("accepts known presets", () => {
    expect(isPeriodPreset("this_month")).toBe(true);
  });
  it("rejects unknown / non-string values", () => {
    expect(isPeriodPreset("yesterday")).toBe(false);
    expect(isPeriodPreset(undefined)).toBe(false);
  });
});

describe("isValidIsoDate", () => {
  it("accepts a real calendar date", () => {
    expect(isValidIsoDate("2026-05-13")).toBe(true);
  });
  it("rejects an out-of-range day", () => {
    expect(isValidIsoDate("2026-02-31")).toBe(false);
  });
  it("rejects malformed strings", () => {
    expect(isValidIsoDate("2026-5-1")).toBe(false);
    expect(isValidIsoDate("not-a-date")).toBe(false);
    expect(isValidIsoDate(undefined)).toBe(false);
  });
});

describe("resolveDateRange", () => {
  const now = kyivDay("2026-05-13");

  it("a valid preset wins over custom dates", () => {
    expect(
      resolveDateRange({ period: "today", from: "2020-01-01", to: "2020-02-02" }, now),
    ).toEqual({ from: "2026-05-13", to: "2026-05-13" });
  });

  it("custom range is taken when no valid preset", () => {
    expect(resolveDateRange({ from: "2026-01-01", to: "2026-03-31" }, now)).toEqual({
      from: "2026-01-01",
      to: "2026-03-31",
    });
  });

  it("supports an open-ended range", () => {
    expect(resolveDateRange({ from: "2026-01-01" }, now)).toEqual({ from: "2026-01-01" });
    expect(resolveDateRange({ to: "2026-12-31" }, now)).toEqual({ to: "2026-12-31" });
  });

  it("ignores invalid custom bounds", () => {
    expect(resolveDateRange({ from: "2026-02-31", to: "bad" }, now)).toEqual({});
  });

  it("ignores an unknown preset and falls back to custom", () => {
    expect(resolveDateRange({ period: "decade", from: "2026-01-01" }, now)).toEqual({
      from: "2026-01-01",
    });
  });
});

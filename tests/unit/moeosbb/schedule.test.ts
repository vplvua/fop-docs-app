import { describe, expect, it } from "vitest";

import { shouldRunSync } from "@/lib/external-apis/moeosbb/schedule";

describe("shouldRunSync", () => {
  describe("first", () => {
    it("returns true on day 1", () => {
      expect(shouldRunSync("first", new Date(2026, 0, 1))).toBe(true);
    });

    it("returns false on day 2", () => {
      expect(shouldRunSync("first", new Date(2026, 0, 2))).toBe(false);
    });

    it("returns false on day 15", () => {
      expect(shouldRunSync("first", new Date(2026, 0, 15))).toBe(false);
    });

    it("returns true on Feb 1", () => {
      expect(shouldRunSync("first", new Date(2026, 1, 1))).toBe(true);
    });
  });

  describe("last", () => {
    it("returns true on Jan 31", () => {
      expect(shouldRunSync("last", new Date(2026, 0, 31))).toBe(true);
    });

    it("returns false on Jan 30", () => {
      expect(shouldRunSync("last", new Date(2026, 0, 30))).toBe(false);
    });

    it("returns true on Feb 28 (non-leap year)", () => {
      expect(shouldRunSync("last", new Date(2026, 1, 28))).toBe(true);
    });

    it("returns true on Feb 29 (leap year 2028)", () => {
      expect(shouldRunSync("last", new Date(2028, 1, 29))).toBe(true);
    });

    it("returns false on Feb 28 (leap year 2028)", () => {
      expect(shouldRunSync("last", new Date(2028, 1, 28))).toBe(false);
    });

    it("returns true on Apr 30", () => {
      expect(shouldRunSync("last", new Date(2026, 3, 30))).toBe(true);
    });
  });

  describe("manual", () => {
    it("returns false on day 1", () => {
      expect(shouldRunSync("manual", new Date(2026, 0, 1))).toBe(false);
    });

    it("returns false on day 31", () => {
      expect(shouldRunSync("manual", new Date(2026, 0, 31))).toBe(false);
    });
  });

  describe("unknown schedule", () => {
    it("returns false for unknown value", () => {
      expect(shouldRunSync("weekly", new Date(2026, 0, 1))).toBe(false);
    });
  });
});

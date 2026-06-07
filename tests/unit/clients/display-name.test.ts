import { describe, expect, it } from "vitest";

import { displayClientName } from "@/lib/clients/display-name";

describe("displayClientName", () => {
  it("returns the short name when present", () => {
    expect(displayClientName({ name: "ОСББ «Молодіжний»", shortName: "Молодіжний" })).toBe(
      "Молодіжний",
    );
  });

  it("preserves the casing of the short name exactly", () => {
    expect(displayClientName({ name: "ОСББ «X»", shortName: "МОЛОДІЖНИЙ НОВОМОСКОВСЬК" })).toBe(
      "МОЛОДІЖНИЙ НОВОМОСКОВСЬК",
    );
  });

  it("falls back to the full name when short name is null", () => {
    expect(displayClientName({ name: "ТОВ «Ромашка»", shortName: null })).toBe("ТОВ «Ромашка»");
  });

  it("falls back to the full name when short name is undefined", () => {
    expect(displayClientName({ name: "ТОВ «Ромашка»" })).toBe("ТОВ «Ромашка»");
  });

  it("falls back to the full name when short name is an empty string", () => {
    expect(displayClientName({ name: "ТОВ «Ромашка»", shortName: "" })).toBe("ТОВ «Ромашка»");
  });

  it("falls back to the full name when short name is whitespace only", () => {
    expect(displayClientName({ name: "ТОВ «Ромашка»", shortName: "   " })).toBe("ТОВ «Ромашка»");
  });
});

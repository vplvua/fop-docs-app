import { describe, expect, it } from "vitest";

import { detectServiceType } from "@/lib/classification/detect-service-type";

const keywords = ["смс", "sms", "розсилка"];

describe("detectServiceType", () => {
  it("returns sms when keyword found", () => {
    expect(detectServiceType("Оплата за СМС розсилку", keywords)).toBe("sms");
  });

  it("returns access when no keyword found", () => {
    expect(detectServiceType("Оплата по договір №556770", keywords)).toBe("access");
  });

  it("is case-insensitive", () => {
    expect(detectServiceType("Оплата за SMS послуги", keywords)).toBe("sms");
  });

  it("returns access for empty keywords list", () => {
    expect(detectServiceType("Оплата за СМС", [])).toBe("access");
  });
});

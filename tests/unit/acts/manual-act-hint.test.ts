import { describe, expect, it } from "vitest";

import { suggestManualActPricing } from "@/lib/acts/manual-act-hint";
import type { SmsPrice, Tariff } from "@/lib/db/schema/tariffs";

const tariff = (over: Partial<Tariff> = {}): Tariff => ({
  id: crypto.randomUUID(),
  apartmentsMin: 0,
  apartmentsMax: null,
  price: "200.00",
  effectiveFrom: "2024-01-01",
  createdAt: new Date(),
  updatedAt: new Date(),
  ...over,
});

const smsPrice = (over: Partial<SmsPrice> = {}): SmsPrice => ({
  id: crypto.randomUUID(),
  price: "1.40",
  effectiveFrom: "2024-01-01",
  createdAt: new Date(),
  ...over,
});

const client = { apartmentsCount: 50, accessPriceOverride: null };

describe("suggestManualActPricing", () => {
  it("resolves the access tariff price with a default quantity of 1", () => {
    const hint = suggestManualActPricing({
      client,
      serviceType: "access",
      tariffs: [tariff()],
      smsPrices: [],
      asOf: "2025-12-31",
    });
    expect(hint.unitPrice).toBe("200.00");
    expect(hint.defaultQuantity).toBe("1");
  });

  it("prefers a client access-price override", () => {
    const hint = suggestManualActPricing({
      client: { apartmentsCount: 50, accessPriceOverride: "150.00" },
      serviceType: "access",
      tariffs: [tariff()],
      smsPrices: [],
      asOf: "2025-12-31",
    });
    expect(hint.unitPrice).toBe("150.00");
  });

  it("resolves the SMS price for the sms service", () => {
    const hint = suggestManualActPricing({
      client,
      serviceType: "sms",
      tariffs: [],
      smsPrices: [smsPrice()],
      asOf: "2025-12-31",
    });
    expect(hint.unitPrice).toBe("1.40");
    expect(hint.defaultQuantity).toBe("1");
  });

  it("returns null unitPrice when no tariff is effective for the period", () => {
    const hint = suggestManualActPricing({
      client,
      serviceType: "access",
      tariffs: [tariff({ effectiveFrom: "2030-01-01" })],
      smsPrices: [],
      asOf: "2025-12-31",
    });
    expect(hint.unitPrice).toBeNull();
  });
});

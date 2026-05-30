import type { ServiceType } from "@/lib/classification/types";
import type { SmsPrice, Tariff } from "@/lib/db/schema/tariffs";
import { resolveAccessPrice, resolveSmsPrice } from "@/lib/tariffs";

interface HintClient {
  apartmentsCount: number | null;
  accessPriceOverride: string | null;
}

export interface PricingHint {
  /** Suggested unit price from the effective tariff, or null when none applies. */
  unitPrice: string | null;
  /** Default quantity hint (overridable by the admin). */
  defaultQuantity: string;
}

/**
 * Suggest an overridable unit price and default quantity for a manual act, using
 * the same tariff resolution the auto path uses. `asOf` is the period-end date so
 * the hint reflects the tariff effective for the chosen period (D4). The admin
 * may override both quantity and the final amount; this is only a hint.
 */
export function suggestManualActPricing(args: {
  client: HintClient;
  serviceType: ServiceType;
  tariffs: Tariff[];
  smsPrices: SmsPrice[];
  asOf: string;
}): PricingHint {
  if (args.serviceType === "access") {
    return {
      unitPrice: resolveAccessPrice(args.client, args.tariffs, args.asOf),
      defaultQuantity: "1",
    };
  }
  return { unitPrice: resolveSmsPrice(args.smsPrices, args.asOf), defaultQuantity: "1" };
}

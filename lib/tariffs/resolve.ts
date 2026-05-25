import type { SmsPrice, Tariff } from "@/lib/db/schema/tariffs";

interface ClientForResolve {
  apartmentsCount: number | null;
  accessPriceOverride: string | null;
}

function latestEffective(arr: Tariff[]): Tariff | undefined {
  return arr.toSorted((a, b) => {
    if (a.effectiveFrom > b.effectiveFrom) return -1;
    if (a.effectiveFrom < b.effectiveFrom) return 1;
    return 0;
  })[0];
}

export function resolveAccessPrice(
  client: ClientForResolve,
  allTariffs: Tariff[],
  paymentDate: string,
): string | null {
  if (client.accessPriceOverride) {
    return client.accessPriceOverride;
  }

  const effective = allTariffs.filter((t) => t.effectiveFrom <= paymentDate);
  if (effective.length === 0) return null;

  const apartments = client.apartmentsCount ?? 0;

  const matching = effective.filter((t) => {
    if (t.apartmentsMax === null) return true;
    return apartments >= t.apartmentsMin && apartments <= t.apartmentsMax;
  });

  if (matching.length === 0) return null;

  const ranged = matching.filter((t) => t.apartmentsMax !== null);
  const catchAll = matching.filter((t) => t.apartmentsMax === null);

  if (ranged.length > 0) {
    const narrowest = ranged.toSorted((a, b) => {
      const rangeA = (a.apartmentsMax ?? 0) - a.apartmentsMin;
      const rangeB = (b.apartmentsMax ?? 0) - b.apartmentsMin;
      if (rangeA !== rangeB) return rangeA - rangeB;
      if (a.effectiveFrom > b.effectiveFrom) return -1;
      if (a.effectiveFrom < b.effectiveFrom) return 1;
      return 0;
    });
    return narrowest[0]?.price ?? null;
  }

  const best = latestEffective(catchAll);
  return best?.price ?? null;
}

export function resolveSmsPrice(allPrices: SmsPrice[], paymentDate: string): string | null {
  const effective = allPrices
    .filter((p) => p.effectiveFrom <= paymentDate)
    .toSorted((a, b) => {
      if (a.effectiveFrom > b.effectiveFrom) return -1;
      if (a.effectiveFrom < b.effectiveFrom) return 1;
      return 0;
    });

  return effective[0]?.price ?? null;
}

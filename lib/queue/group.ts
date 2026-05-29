import { parseReason } from "./reasons";

/**
 * Fixed actionability priority for queue reason groups: the most directly
 * resolvable reasons surface first; informational/manual-workflow reasons last.
 * Legacy `ambiguous_client` (D-041) sorts last among known reasons.
 */
export const REASON_ORDER = [
  "no_match",
  "multiple_clients_same_edrpou",
  "client_incomplete",
  "multiple_contracts",
  "amount_mismatch",
  "sms_quantity_mismatch",
  "auto_act_disabled",
  "external_edo",
  "ambiguous_client",
] as const;

export interface ReasonGroup<T> {
  /** Reason key (e.g. `no_match`); `other` for rows with no parseable reason. */
  key: string;
  items: T[];
}

function orderIndex(key: string): number {
  const idx = (REASON_ORDER as readonly string[]).indexOf(key);
  // Unknown reasons sort after all known ones, but before the `other` bucket.
  return idx === -1 ? REASON_ORDER.length : idx;
}

/**
 * Bucket payments by their `classificationReason` key and return groups ordered
 * by {@link REASON_ORDER}. Each payment keeps its own `classificationReason`, so
 * per-payment detail (e.g. the missing-field list) is recovered downstream via
 * {@link parseReason}. Insertion order of payments within a group is preserved.
 */
export function groupByReason<T extends { classificationReason: string | null }>(
  payments: readonly T[],
): ReasonGroup<T>[] {
  const buckets = new Map<string, T[]>();

  for (const payment of payments) {
    const key = payment.classificationReason
      ? parseReason(payment.classificationReason).key
      : "other";
    const bucket = buckets.get(key);
    if (bucket) bucket.push(payment);
    else buckets.set(key, [payment]);
  }

  return [...buckets.entries()]
    .map(([key, items]) => ({ key, items }))
    .toSorted((a, b) => {
      const diff = orderIndex(a.key) - orderIndex(b.key);
      if (diff !== 0) return diff;
      // Stable tie-break for unknown/`other` keys so output is deterministic.
      return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
    });
}

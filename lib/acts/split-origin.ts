/**
 * Pure helpers for the split-managed marker stored on
 * `payments.classification_reason`. Kept db-free so both the orchestrator and the
 * manual-act edit/delete guards can import it without pulling in the DB client,
 * and so it is unit-testable in isolation.
 *
 * A split payment stamps `split_origin:<pre-split status>` on its
 * `classification_reason`: it both marks the payment as split-managed (offers
 * cancel, blocks per-act edit/delete) and remembers the status to restore on
 * cancel (skipped→skipped, otherwise received).
 */
export const SPLIT_ORIGIN_PREFIX = "split_origin:";

/** Whether a payment is split-managed, from its `classification_reason`. */
export function isSplitPayment(classificationReason: string | null): boolean {
  return classificationReason?.startsWith(SPLIT_ORIGIN_PREFIX) ?? false;
}

/** The marker stored for a payment split from `priorStatus`. */
export function splitOriginMarker(priorStatus: string): string {
  return `${SPLIT_ORIGIN_PREFIX}${priorStatus}`;
}

/** Status to restore when a split is cancelled: skipped if it was skipped before,
 * otherwise received (D-042). */
export function preSplitStatus(classificationReason: string | null): "skipped" | "received" {
  return classificationReason === splitOriginMarker("skipped") ? "skipped" : "received";
}

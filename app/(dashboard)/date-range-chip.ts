import type { FilterChip } from "@/app/components/data-table";
import { isPeriodPreset, isValidIsoDate, PERIOD_LABELS } from "@/lib/data-tables/date-ranges";

/**
 * Build the active-filter chip for the date-range filter shared by `/payments`
 * and `/acts`. A valid preset wins (clears `period`); otherwise a custom range
 * (open-ended allowed) clears `from`/`to`. Returns `null` when no date filter is
 * applied, so default-state surfaces show no chip.
 */
export function dateRangeChip(params: {
  period?: string | undefined;
  from?: string | undefined;
  to?: string | undefined;
}): FilterChip | null {
  if (isPeriodPreset(params.period)) {
    return { keys: ["period"], label: `Період: ${PERIOD_LABELS[params.period]}` };
  }
  const from = isValidIsoDate(params.from) ? params.from : undefined;
  const to = isValidIsoDate(params.to) ? params.to : undefined;
  if (from && to) return { keys: ["from", "to"], label: `Період: ${from} – ${to}` };
  if (from) return { keys: ["from", "to"], label: `Період: від ${from}` };
  if (to) return { keys: ["from", "to"], label: `Період: до ${to}` };
  return null;
}

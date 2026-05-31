/**
 * Format a money amount as a thousands-separated `uk-UA` number with two
 * decimals — e.g. `12 500,00` (narrow no-break space group separator, comma
 * decimal). The currency unit is shown in the column header, not per cell.
 *
 * Accepts the `numeric` columns' string form or a number; non-numeric input
 * falls back to the raw string so a cell never renders `NaN`.
 */
export function formatAmount(value: number | string): string {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return String(value);
  return new Intl.NumberFormat("uk-UA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

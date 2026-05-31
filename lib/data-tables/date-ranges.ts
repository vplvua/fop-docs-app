/**
 * Pure date-range resolution for the list-surface date filters. No Next.js / DB
 * imports — safe from server pages, services, and unit tests.
 *
 * Presets are computed in **Europe/Kyiv** with the **week starting Monday**.
 * `now` is injected (the app forbids `Date.now()` in some contexts and it keeps
 * the function testable). The output is inclusive `YYYY-MM-DD` strings, compared
 * directly against the `date` columns (`payment_date` / `act_date`) — Kyiv only
 * governs which calendar day boundaries fall on, the column itself is tz-free.
 */

export const PERIOD_PRESETS = [
  "today",
  "this_week",
  "last_week",
  "this_month",
  "last_month",
  "this_quarter",
  "last_quarter",
] as const;

export type PeriodPreset = (typeof PERIOD_PRESETS)[number];

/** Localized preset labels for the filter dropdown + active-filter chips. */
export const PERIOD_LABELS: Record<PeriodPreset, string> = {
  today: "Сьогодні",
  this_week: "Цей тиждень",
  last_week: "Минулий тиждень",
  this_month: "Цей місяць",
  last_month: "Минулий місяць",
  this_quarter: "Цей квартал",
  last_quarter: "Минулий квартал",
};

export interface DateRange {
  from: string;
  to: string;
}

export function isPeriodPreset(value: unknown): value is PeriodPreset {
  return typeof value === "string" && (PERIOD_PRESETS as readonly string[]).includes(value);
}

/** Strict `YYYY-MM-DD` calendar-date validator (rejects e.g. 2026-02-31). */
export function isValidIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parts = value.split("-");
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

const DAY_MS = 86_400_000;

function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

/** Civil calendar date (Y/M/D) of an instant as seen in Europe/Kyiv. */
function kyivCivilDate(now: Date): { y: number; m: number; d: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Kyiv",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { y: get("year"), m: get("month"), d: get("day") };
}

/**
 * Resolve a preset key to an inclusive `{ from, to }` calendar range, anchored
 * on "today" in Europe/Kyiv. Calendar math runs on a UTC-midnight anchor so it
 * is DST-free; only the anchor day is timezone-derived.
 */
export function resolvePeriod(preset: PeriodPreset, now: Date): DateRange {
  const { y, m, d } = kyivCivilDate(now);
  const today = new Date(Date.UTC(y, m - 1, d));

  switch (preset) {
    case "today":
      return { from: iso(today), to: iso(today) };

    case "this_week": {
      // getUTCDay: 0=Sun..6=Sat; Monday is the week start.
      const monday = addDays(today, -((today.getUTCDay() + 6) % 7));
      return { from: iso(monday), to: iso(addDays(monday, 6)) };
    }

    case "last_week": {
      const monday = addDays(today, -((today.getUTCDay() + 6) % 7));
      return { from: iso(addDays(monday, -7)), to: iso(addDays(monday, -1)) };
    }

    case "this_month":
      return {
        from: iso(new Date(Date.UTC(y, m - 1, 1))),
        to: iso(new Date(Date.UTC(y, m, 0))),
      };

    case "last_month":
      return {
        from: iso(new Date(Date.UTC(y, m - 2, 1))),
        to: iso(new Date(Date.UTC(y, m - 1, 0))),
      };

    case "this_quarter": {
      const startMonth = Math.floor((m - 1) / 3) * 3;
      return {
        from: iso(new Date(Date.UTC(y, startMonth, 1))),
        to: iso(new Date(Date.UTC(y, startMonth + 3, 0))),
      };
    }

    case "last_quarter": {
      const startMonth = Math.floor((m - 1) / 3) * 3 - 3;
      // Date.UTC rolls negative months into the previous year automatically.
      return {
        from: iso(new Date(Date.UTC(y, startMonth, 1))),
        to: iso(new Date(Date.UTC(y, startMonth + 3, 0))),
      };
    }
  }
}

/**
 * Translate the raw `period` / `from` / `to` URL params into an inclusive range.
 * A valid preset wins (preset and custom dates are mutually exclusive); otherwise
 * each custom bound is taken only if it is a valid ISO date (open-ended allowed,
 * invalid bounds ignored). Returns `{}` when nothing applies.
 */
export function resolveDateRange(
  input: { period?: string | undefined; from?: string | undefined; to?: string | undefined },
  now: Date,
): { from?: string; to?: string } {
  if (isPeriodPreset(input.period)) {
    return resolvePeriod(input.period, now);
  }
  const range: { from?: string; to?: string } = {};
  if (isValidIsoDate(input.from)) range.from = input.from;
  if (isValidIsoDate(input.to)) range.to = input.to;
  return range;
}

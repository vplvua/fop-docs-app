"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useTransition, type ChangeEvent } from "react";

import { cn } from "@/lib/utils";
import { PERIOD_LABELS, PERIOD_PRESETS } from "@/lib/data-tables/date-ranges";

const SELECT_CLASS = cn(
  "h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground",
  "focus:outline-none focus:ring-2 focus:ring-ring",
);

const DATE_CLASS = cn(
  "h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground",
  "focus:outline-none focus:ring-2 focus:ring-ring",
);

/**
 * Date-range filter: a preset dropdown (Сьогодні … Минулий квартал) plus a
 * custom from/to pair. Preset and custom are mutually exclusive — picking a
 * preset clears the custom dates and vice-versa. Default is "без фільтра" (no
 * date filter). Every change drops `page` so results restart at page 1.
 */
export function DateRangeFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const period = searchParams.get("period") ?? "";
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";

  const push = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString());
      mutate(params);
      params.delete("page");
      const qs = params.toString();
      startTransition(() => {
        router.replace(qs ? `${pathname}?${qs}` : pathname);
      });
    },
    [router, pathname, searchParams],
  );

  const handlePreset = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      const value = event.target.value;
      push((params) => {
        params.delete("from");
        params.delete("to");
        if (value) params.set("period", value);
        else params.delete("period");
      });
    },
    [push],
  );

  const handleCustom = useCallback(
    (key: "from" | "to") => (event: ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      push((params) => {
        params.delete("period");
        if (value) params.set(key, value);
        else params.delete(key);
      });
    },
    [push],
  );

  return (
    <div className="flex items-center gap-2" aria-busy={isPending || undefined}>
      <select value={period} onChange={handlePreset} aria-label="Період" className={SELECT_CLASS}>
        <option value="">Без фільтра</option>
        {PERIOD_PRESETS.map((preset) => (
          <option key={preset} value={preset}>
            {PERIOD_LABELS[preset]}
          </option>
        ))}
      </select>
      <input
        type="date"
        value={from}
        onChange={handleCustom("from")}
        aria-label="Дата від"
        className={DATE_CLASS}
      />
      <span className="text-sm text-muted-foreground">—</span>
      <input
        type="date"
        value={to}
        onChange={handleCustom("to")}
        aria-label="Дата до"
        className={DATE_CLASS}
      />
    </div>
  );
}

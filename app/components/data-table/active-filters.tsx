"use client";

import { X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

export interface FilterChip {
  /** URL params this chip clears when removed (e.g. `["period"]`, `["from","to"]`). */
  keys: string[];
  /** Already-localized chip text (e.g. `Статус: Чернетка`). */
  label: string;
}

/**
 * Removable chips for the currently-applied search + filters, so the operator
 * can see at a glance what is constraining the list. Each chip's ✕ clears only
 * its own param(s) and drops `page`; the rest stay applied. Renders nothing when
 * no filter is active (default-state params produce no chip — the caller decides
 * which params are non-default).
 */
export function ActiveFilters({ chips }: { chips: FilterChip[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const remove = useCallback(
    (keys: string[]) => {
      const params = new URLSearchParams(searchParams.toString());
      keys.forEach((key) => params.delete(key));
      params.delete("page");
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    },
    [router, pathname, searchParams],
  );

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {chips.map((chip) => (
        <Chip key={chip.keys.join(",")} chip={chip} onRemove={remove} />
      ))}
    </div>
  );
}

function Chip({ chip, onRemove }: { chip: FilterChip; onRemove: (keys: string[]) => void }) {
  const handleClick = useCallback(() => onRemove(chip.keys), [onRemove, chip]);

  return (
    <span className="inline-flex h-7 items-center gap-1 rounded-full border border-primary bg-primary/10 pl-2.5 pr-1 text-xs font-medium text-primary">
      {chip.label}
      <button
        type="button"
        onClick={handleClick}
        aria-label={`Прибрати фільтр: ${chip.label}`}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full transition-colors hover:bg-primary/20"
      >
        <X className="h-3 w-3" aria-hidden />
      </button>
    </span>
  );
}

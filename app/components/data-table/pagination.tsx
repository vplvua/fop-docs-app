"use client";

import { useCallback, type ChangeEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { PER_PAGE_OPTIONS, totalPagesFor } from "@/lib/data-tables/parse-table-query";

interface PaginationProps {
  /** Current (already clamped) 1-based page. */
  page: number;
  perPage: number;
  /** Total rows across all pages for the active filter set. */
  totalCount: number;
}

const NAV_BUTTON = cn(
  "inline-flex items-center gap-1 rounded-md px-2 py-1 font-medium",
  "text-muted-foreground transition-colors hover:text-foreground",
  "disabled:pointer-events-none disabled:opacity-40",
);

const SELECT_CLASS = cn(
  "rounded-md border border-input bg-background px-2 py-1",
  "text-foreground focus:ring-2 focus:ring-ring focus:outline-none",
);

/**
 * Footer pager: page-size select + prev/next + page X/Y + total count.
 * Navigates by mutating the URL search params, preserving everything else.
 * Designed to sit in the `DataTablePage` sticky footer slot.
 */
export function Pagination({ page, perPage, totalCount }: PaginationProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const totalPages = totalPagesFor(totalCount, perPage);

  const pushParams = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString());
      mutate(params);
      const qs = params.toString();
      router.push(qs ? `?${qs}` : "?");
    },
    [router, searchParams],
  );

  const goToPage = useCallback(
    (next: number) => {
      pushParams((params) => {
        if (next <= 1) params.delete("page");
        else params.set("page", String(next));
      });
    },
    [pushParams],
  );

  const handlePrev = useCallback(() => goToPage(page - 1), [goToPage, page]);
  const handleNext = useCallback(() => goToPage(page + 1), [goToPage, page]);

  const handlePerPage = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      const value = event.target.value;
      pushParams((params) => {
        params.set("perPage", value);
        params.delete("page");
      });
    },
    [pushParams],
  );

  return (
    <div className="flex w-full items-center justify-between gap-4 text-sm">
      <label className="flex items-center gap-2">
        <select
          value={perPage}
          onChange={handlePerPage}
          aria-label="Рядків на сторінці"
          className={SELECT_CLASS}
        >
          {PER_PAGE_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <span className="text-muted-foreground">на сторінці</span>
      </label>

      <div className="flex items-center gap-2">
        <button type="button" onClick={handlePrev} disabled={page <= 1} className={NAV_BUTTON}>
          <ChevronLeft className="h-4 w-4" />
          Назад
        </button>
        <span className="text-muted-foreground tabular-nums">
          Сторінка {page} / {totalPages}
        </span>
        <button
          type="button"
          onClick={handleNext}
          disabled={page >= totalPages}
          className={NAV_BUTTON}
        >
          Далі
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <span className="text-muted-foreground tabular-nums">{totalCount} записів</span>
    </div>
  );
}

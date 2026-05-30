"use client";

import { useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";

import { cn } from "@/lib/utils";
import type { SortDir } from "@/lib/data-tables/parse-table-query";

interface SortableHeaderProps {
  /** Visible header label (already localized). */
  label: string;
  /** Allow-listed sort column key for this column. */
  sortKey: string;
  /** Active sort key from the parsed query. */
  currentSort: string;
  /** Active sort direction from the parsed query. */
  currentDir: SortDir;
  /** Direction applied on first activation of this column (default `asc`). */
  defaultDir?: SortDir;
}

/**
 * Clickable column header. Renders inside the `<th>` supplied by `DataTable`,
 * so it inherits the header typography and only owns the button + sort icon.
 * Clicking the active column toggles direction; clicking another column
 * switches to it. Always drops `page` so re-sorting starts at page 1.
 */
export function SortableHeader({
  label,
  sortKey,
  currentSort,
  currentDir,
  defaultDir = "asc",
}: SortableHeaderProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const active = currentSort === sortKey;
  const nextDir: SortDir = active ? (currentDir === "asc" ? "desc" : "asc") : defaultDir;

  const handleClick = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("sort", sortKey);
    params.set("dir", nextDir);
    params.delete("page");
    router.push(`?${params.toString()}`);
  }, [router, searchParams, sortKey, nextDir]);

  const Icon = active ? (currentDir === "asc" ? ArrowUp : ArrowDown) : ChevronsUpDown;

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={`Сортувати за «${label}»`}
      className={cn(
        "inline-flex items-center gap-1 transition-colors hover:text-foreground",
        active && "text-foreground",
      )}
    >
      {label}
      <Icon
        className={cn("h-3.5 w-3.5 shrink-0", active ? "opacity-100" : "opacity-40")}
        aria-hidden
      />
    </button>
  );
}

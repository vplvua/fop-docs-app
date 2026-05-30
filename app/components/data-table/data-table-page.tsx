import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Page-level flex column for a list surface. Lives inside the fixed-viewport
 * dashboard shell (`app/(dashboard)/layout.tsx`) and owns the single scroll
 * region: only `children` (the table body) scrolls, while the `header` slot
 * (heading + toolbar) and the `footer` slot (reserved for pagination) stay
 * pinned. `pending` dims the scroll body during in-place re-queries
 * (wired up by `table-search-filters`).
 */
export function DataTablePage({
  header,
  footer,
  children,
  pending = false,
}: {
  header: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  pending?: boolean;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 bg-background">
        <div className="mx-auto max-w-6xl space-y-6 px-4 py-6">{header}</div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <div
          className={cn(
            "mx-auto max-w-6xl px-4 pb-4 transition-opacity",
            pending && "pointer-events-none opacity-60",
          )}
          aria-busy={pending || undefined}
        >
          {children}
        </div>
      </div>

      {/* Reserved sticky footer slot — filled by `table-pagination-sorting`. */}
      <div className="shrink-0 border-t border-border bg-background">
        {footer ? (
          <div className="mx-auto flex max-w-6xl items-center px-4 py-3">{footer}</div>
        ) : (
          <div className="h-2" aria-hidden />
        )}
      </div>
    </div>
  );
}

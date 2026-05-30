import type { ReactNode, ThHTMLAttributes, TdHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

/**
 * Semantic `<table>` inside a `DataTablePage` scroll region.
 *
 * No outer scroll/overflow wrapper: the sticky `<thead>` pins to the page's
 * `overflow-auto` scroll region (both axes scroll there), and the table sits
 * flush under the page chrome — its own `<thead>` bottom border is the only
 * divider. The `DataTableHead` background must stay opaque so rows don't bleed
 * through while scrolling.
 */
export function DataTable({ children }: { children: ReactNode }) {
  return <table className="w-full text-left text-sm">{children}</table>;
}

/**
 * Sticky column header. `top-0` pins it to the top of the scroll container;
 * the background MUST stay opaque (`bg-muted`) so scrolling rows don't bleed
 * through.
 */
export function DataTableHead({ children }: { children: ReactNode }) {
  return <thead className="sticky top-0 z-10 border-b border-border bg-muted">{children}</thead>;
}

export function DataTableBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-border">{children}</tbody>;
}

/** Shared header cell — padding + uppercase label typography lifted from the three list copies. */
export function Th({
  children,
  className,
  ...props
}: ThHTMLAttributes<HTMLTableCellElement> & { children: ReactNode }) {
  return (
    <th
      className={cn(
        "px-4 py-2.5 text-xs font-medium uppercase tracking-wider text-muted-foreground",
        className,
      )}
      {...props}
    >
      {children}
    </th>
  );
}

/** Shared body cell — padding + base typography lifted from the three list copies. */
export function Td({
  children,
  className,
  ...props
}: TdHTMLAttributes<HTMLTableCellElement> & { children: ReactNode }) {
  return (
    <td className={cn("px-4 py-3 text-sm text-foreground", className)} {...props}>
      {children}
    </td>
  );
}

import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Full-row navigation target. Renders the `<tr>` as the positioning context for
 * a stretched overlay anchor (`absolute inset-0`) so clicking anywhere on the
 * row navigates, while keeping a real `<a href>` (Next.js `Link`) — so
 * middle-click / ⌘-click open a new tab and keyboard focus + Enter work.
 *
 * `children` are the visible `<td>` cells; the overlay lives in a trailing
 * zero-width cell that adds no visible column. `className` merges extra row
 * classes (e.g. per-row borders on tables that don't use the shared `Td`).
 */
export function RowLink({
  href,
  label,
  children,
  className,
}: {
  href: string;
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <tr className={cn("relative cursor-pointer transition-colors hover:bg-accent/50", className)}>
      {children}
      <td className="w-0 p-0">
        <Link href={href} aria-label={label} className="absolute inset-0" />
      </td>
    </tr>
  );
}

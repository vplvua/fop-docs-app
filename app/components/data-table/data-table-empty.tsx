import type { ReactNode } from "react";

/** Centered empty-state for a data table (e.g. "Клієнтів не знайдено."). */
export function DataTableEmpty({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-border">
      <p className="py-12 text-center text-sm text-muted-foreground">{children}</p>
    </div>
  );
}

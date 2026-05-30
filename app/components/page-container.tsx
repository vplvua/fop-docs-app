import type { ReactNode } from "react";

/**
 * Scroll + centering container for ordinary (non-list) dashboard pages.
 *
 * The dashboard layout (`app/(dashboard)/layout.tsx`) is a fixed-viewport flex
 * shell that does not scroll and does not pad its children — the list surfaces
 * own their scroll via `DataTablePage`. Every other page (dashboard home,
 * detail, form, import) wraps its content in this container so it keeps the
 * centered, padded, document-scroll behavior the old layout provided.
 */
export function PageContainer({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-6xl px-4 py-8">{children}</div>
    </div>
  );
}

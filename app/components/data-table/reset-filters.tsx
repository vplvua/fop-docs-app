"use client";

import { X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

/**
 * "Reset" control. Visible only when at least one of the given filter/search
 * `keys` is present in the URL.
 *
 * Default mode clears the whole surface: it navigates to the bare pathname,
 * dropping search, every filter, and pagination/sort (which fall back to their
 * defaults) — the "Скинути все" used on the main list surfaces.
 *
 * `scoped` mode deletes only the listed `keys`, preserving everything else in
 * the URL (e.g. the client card's `tab` and the other tab's date filter), so a
 * single tab's filter can be reset without disturbing the rest.
 */
export function ResetFilters({
  keys,
  scoped = false,
}: {
  keys: readonly string[];
  scoped?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const active = keys.some((key) => searchParams.has(key));

  const handleReset = useCallback(() => {
    if (!scoped) {
      router.replace(pathname);
      return;
    }
    const params = new URLSearchParams(searchParams.toString());
    keys.forEach((key) => params.delete(key));
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }, [router, pathname, searchParams, keys, scoped]);

  if (!active) return null;

  return (
    <button
      type="button"
      onClick={handleReset}
      className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
    >
      <X className="h-3.5 w-3.5" aria-hidden />
      {scoped ? "Скинути" : "Скинути все"}
    </button>
  );
}

"use client";

import { X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

/**
 * "Reset all" control. Visible only when at least one of the given filter/search
 * `keys` is present in the URL. Activating it returns the surface to its default
 * view by navigating to the bare pathname — clearing search, every filter, and
 * pagination/sort (which fall back to their defaults).
 */
export function ResetFilters({ keys }: { keys: readonly string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const active = keys.some((key) => searchParams.has(key));

  const handleReset = useCallback(() => {
    router.replace(pathname);
  }, [router, pathname]);

  if (!active) return null;

  return (
    <button
      type="button"
      onClick={handleReset}
      className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
    >
      <X className="h-3.5 w-3.5" aria-hidden />
      Скинути все
    </button>
  );
}

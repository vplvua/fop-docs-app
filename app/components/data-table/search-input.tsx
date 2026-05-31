"use client";

import { Loader2, Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition, type ChangeEvent } from "react";

import { cn } from "@/lib/utils";

const DEBOUNCE_MS = 300;

/**
 * Debounced, server-backed search box. Typing schedules a `router.replace`
 * (~300 ms after the last keystroke) that updates `q` and drops `page` — so the
 * query always re-runs against the whole dataset from page 1, without spamming
 * history. A spinner shows while the navigation transition is pending, feeding
 * the `DataTablePage` `pending` affordance via the same React transition.
 */
export function SearchInput({
  placeholder = "Пошук…",
  ariaLabel = "Пошук",
  className,
}: {
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const urlQ = searchParams.get("q") ?? "";
  const [value, setValue] = useState(urlQ);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // The last `q` we pushed to the URL. Used to tell our own debounced commit
  // echoing back (ignore it) from a genuine external change like reset / chip
  // removal / nav-memory restore (sync the input to it).
  const committed = useRef(urlQ);

  useEffect(() => {
    if (urlQ !== committed.current) {
      committed.current = urlQ;
      setValue(urlQ);
    }
  }, [urlQ]);

  const commit = useCallback(
    (next: string) => {
      const params = new URLSearchParams(searchParams.toString());
      const trimmed = next.trim();
      if (trimmed) params.set("q", trimmed);
      else params.delete("q");
      params.delete("page");
      committed.current = trimmed;
      const qs = params.toString();
      startTransition(() => {
        router.replace(qs ? `${pathname}?${qs}` : pathname);
      });
    },
    [router, pathname, searchParams],
  );

  const handleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const next = event.target.value;
      setValue(next);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => commit(next), DEBOUNCE_MS);
    },
    [commit],
  );

  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <div className={cn("relative", className)}>
      <Search
        className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <input
        type="search"
        value={value}
        placeholder={placeholder}
        aria-label={ariaLabel}
        onChange={handleChange}
        className="h-9 w-full rounded-md border border-input bg-background pl-8 pr-8 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      />
      {isPending ? (
        <Loader2
          className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground"
          aria-label="Завантаження"
        />
      ) : null}
    </div>
  );
}

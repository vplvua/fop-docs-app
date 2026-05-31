/**
 * Build a quick-filter link that preserves the current query state. Carries over
 * every active param (search, date range, sort, page size, other filters), drops
 * `page` (filter changes restart at page 1, per `table-pagination-sorting`), and
 * sets/clears the toggled `key`. Keeps date filters from being dropped when a
 * status / service-type chip is clicked.
 */
export function buildFilterHref(
  params: Record<string, string | undefined>,
  basePath: string,
  key: string,
  value: string | null,
): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v && k !== "page" && k !== key) sp.set(k, v);
  }
  if (value) sp.set(key, value);
  const qs = sp.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

/**
 * Pure helpers for table pagination + sorting driven by URL search params.
 * No Next.js / DB imports — safe to use from server pages, services, client
 * components, and unit tests alike.
 */

export type SortDir = "asc" | "desc";

export interface TableQuery {
  page: number;
  perPage: number;
  sort: string;
  dir: SortDir;
}

export interface TableQueryConfig {
  /** Default sort column key when none (or an invalid one) is supplied. */
  defaultSort: string;
  /** Default sort direction when none (or an invalid one) is supplied. */
  defaultDir: SortDir;
  /** Allow-list of sortable column keys; anything else falls back to default. */
  sortable: readonly string[];
}

/** Allowed page sizes, smallest first. */
export const PER_PAGE_OPTIONS = [25, 50, 100] as const;
export const DEFAULT_PER_PAGE = 25;

type RawSearchParams = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Validate raw URL search params into a `{ page, perPage, sort, dir }` tuple.
 * Invalid / missing values fall back to safe defaults so the result is always
 * usable to build a query. `page` is only floored at 1 here; clamping to the
 * last page needs the total count and is done with {@link clampPage}.
 */
export function parseTableQuery(
  searchParams: RawSearchParams,
  config: TableQueryConfig,
): TableQuery {
  const { defaultSort, defaultDir, sortable } = config;

  const perPageRaw = Number(firstValue(searchParams.perPage));
  const perPage = (PER_PAGE_OPTIONS as readonly number[]).includes(perPageRaw)
    ? perPageRaw
    : DEFAULT_PER_PAGE;

  const pageRaw = Math.floor(Number(firstValue(searchParams.page)));
  const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? pageRaw : 1;

  const sortRaw = firstValue(searchParams.sort);
  const sort = sortRaw && sortable.includes(sortRaw) ? sortRaw : defaultSort;

  const dirRaw = firstValue(searchParams.dir);
  const dir: SortDir = dirRaw === "asc" || dirRaw === "desc" ? dirRaw : defaultDir;

  return { page, perPage, sort, dir };
}

/** Total number of pages for a result set (at least 1, even when empty). */
export function totalPagesFor(totalCount: number, perPage: number): number {
  return Math.max(1, Math.ceil(totalCount / perPage));
}

/** Clamp a 1-based page into `[1, totalPages]` (clamp-to-last on overflow). */
export function clampPage(page: number, perPage: number, totalCount: number): number {
  return Math.min(Math.max(page, 1), totalPagesFor(totalCount, perPage));
}

/** Zero-based row offset for a 1-based page. */
export function offsetFor(page: number, perPage: number): number {
  return (page - 1) * perPage;
}

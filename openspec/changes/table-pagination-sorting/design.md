# Design — table-pagination-sorting

## URL contract

All four params live in the query string (source of truth, shareable, back/forward-safe):

| Param | Values | Default | Notes |
|-------|--------|---------|-------|
| `page` | 1-based int | `1` | clamped to `[1, totalPages]` |
| `perPage` | `25` \| `50` \| `100` | `25` | invalid → default |
| `sort` | column key (per-table allow-list) | per-table | unknown key → default |
| `dir` | `asc` \| `desc` | per-table | invalid → default |

These coexist with the filter/search params introduced by `table-search-filters`. Any filter/search change resets `page` to 1 (handled by the toolbar building hrefs without `page`); changing `perPage` also resets to page 1.

## Sortable-column allow-list

Sorting builds `ORDER BY` from a **fixed allow-list per table** — never interpolating a raw client string into SQL. A small pure helper maps `sort` key → Drizzle column + applies `dir`:

- **clients:** `name`, `legalId`, `apartmentsCount`, `moeosbbUserId`, `createdAt` (badge/EDO columns not sortable)
- **payments:** `paymentDate`, `amount`, `payerName` (status badge not sortable)
- **acts:** `actDate`, `number`, `amount`, `serviceType` (client name = snapshot/join, sortable optional; status/EDO not sortable)

Unknown/zero `sort` → the per-table default below.

## Default sorts

- **clients:** `moeosbb_user_id ASC NULLS LAST` — operator works MoeOSBB-id-first; local-only clients (null id) sink to the bottom. (Supersedes the old `name ASC` default.)
- **payments:** `payment_date DESC` (newest first) — unchanged from today.
- **acts:** `act_date DESC, number` — unchanged from today.

`NULLS LAST` is explicit in the order clause so the clients default behaves intuitively.

## Pagination mechanics

- Offset pagination: `LIMIT perPage OFFSET (page-1)*perPage`, plus one `count(*)` over the same `where` to compute `totalPages` and the "X записів" label.
- **Decision: offset, not keyset.** At expected volumes (clients ≤ low thousands, payments/acts growing but operator-scale) offset is simple, supports "jump to page", and the `count(*)` cost is acceptable. Revisit with keyset only if a surface crosses ~10⁵ rows.
- The `count(*)` runs with the active filter `where` so the total reflects search/filters, not the whole table.

## Footer controls (`Pagination` component)

Rendered in the shell's sticky footer slot:

```
[ 25 ▾ ]  записів             ‹ Назад   Сторінка 2 / 7   Далі ›        148 записів
```

- Page-size `<select>` (25/50/100) → navigates with new `perPage`, drops `page`.
- Prev/Next + current/total page; disabled at bounds.
- Total record count label.
- Client component that mutates the URL via `useRouter`/`useSearchParams`, preserving all other params.

## SortableHeader component

A `<th>` button showing the label + a sort icon: neutral (sortable, inactive), ascending, or descending. Clicking toggles `dir` when already active, else sets `sort=key&dir=<table-natural-default>` and drops `page`. Uses lucide chevron/arrow icons via existing icon usage; tokens only.

## Edge cases

- `page` beyond `totalPages` (e.g. filter shrinks the set) → clamp to last page, or render an empty body with the pager showing the real total; choose clamp-to-last for fewer dead-ends.
- Empty result set → `DataTableEmpty` in the body, pager shows "0 записів", page-size select still usable.
- Combined with search debounce (C): the search navigation already drops `page`, so a new query always starts at page 1.

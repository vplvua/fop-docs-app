## 1. Param parsing helper (`lib/data-tables/`)

- [ ] 1.1 Add a pure `parseTableQuery(searchParams, { defaultSort, defaultDir, sortable })` returning validated `{ page, perPage, sort, dir }`; enforce `perPage ∈ {25,50,100}` (default 25), `sort ∈ allow-list` (else default), `dir ∈ {asc,desc}`, `page ≥ 1`; no Next.js import
- [ ] 1.2 Per-table config: sortable allow-lists + default sort/dir for clients (`moeosbb_user_id` asc nulls-last), payments (`payment_date` desc), acts (`act_date` desc, then `number`)
- [ ] 1.3 Unit tests `tests/unit/data-tables/parse-table-query.test.ts` — defaults, invalid values, allow-list rejection, clamping

## 2. Pagination + sort UI (`app/components/data-table/`)

- [ ] 2.1 `Pagination` — page-size `<select>` (25/50/100) + prev/next + current/total page + total count; renders in the shell footer slot; mutates URL preserving other params, drops `page` on page-size change; disabled at bounds
- [ ] 2.2 `SortableHeader` — `<th>` button with neutral/asc/desc sort icon; toggles `dir` when active else sets `sort`+default `dir` and drops `page`; tokens-only icons
- [ ] 2.3 Empty / out-of-range handling: clamp `page` to last page; `DataTableEmpty` body + "0 записів" pager when no rows

## 3. Wire pages to server-side pagination + sorting

- [ ] 3.1 `/clients`: `count(*)` over active `where`, `LIMIT/OFFSET`, dynamic `ORDER BY` from allow-list; default `moeosbb_user_id ASC NULLS LAST`; render `Pagination` in footer + `SortableHeader`s; remove the unbounded full-table load
- [ ] 3.2 `/payments`: same; remove `.limit(500)`; default `payment_date DESC`
- [ ] 3.3 `/acts`: same; remove `.limit(500)`; default `act_date DESC, number`

## 4. Verification

- [ ] 4.1 `npm run qa` — 6/6 gates green
- [ ] 4.2 `npx openspec validate table-pagination-sorting --strict` passes
- [ ] 4.3 Integration smoke (`tests/integration/data-tables/*.smoke.ts`, real Neon test DB): seed > 100 rows; assert page 2 returns the next slice, `count` matches, and a non-default `sort`/`dir` reorders correctly
- [ ] 4.4 Manual smoke (**human-gated**): change page size 25→50→100, page through, click headers to re-sort asc/desc, confirm footer pager stays pinned and total count is correct; verify clients default = MoeOSBB id ascending with null-id clients last
- [ ] 4.5 Capture Real-behavior-proof (verification log of a paged+sorted query + footer/sort-icon screenshot)

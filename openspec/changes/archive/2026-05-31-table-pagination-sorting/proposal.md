## Why

The list surfaces have no pagination and no user-controlled sorting. `/payments` and `/acts` silently cap at `.limit(500)` (rows beyond that are invisible with no indication), and `/clients` loads every row. Sort order is hard-coded (clients by name, payments/acts by date) with no way to re-sort by another column. As the dataset grows (statements accumulate, acts pile up), this becomes both a performance and a usability problem.

This change adds **server-side pagination and column sorting** on top of the shell from `table-layout-shell`. Both are driven by URL search params (the app's existing source of truth), so they compose with the search/filter work in `table-search-filters` and with browser back/forward.

Depends on: `table-layout-shell` (sticky footer slot for the pager, sortable `<thead>` chrome).

## What Changes

- **Server-side pagination** on `/clients`, `/payments`, `/acts`. The page reads `page` and `perPage` from the URL, runs a `count(*)` for the active filter set, and fetches one page via `LIMIT/OFFSET`. The `.limit(500)` caps on payments/acts are removed.
- **Page-size selector** with options **25 / 50 / 100** (default **25**), rendered in the sticky footer slot together with a pager (‹ prev / next ›, current page, total pages, and total record count). Changing page size resets to page 1.
- **Column sorting** via clickable `<thead>` headers on meaningful columns, with an ascending/descending/!-active sort icon. Sort state lives in the URL as `sort` (column key) + `dir` (`asc`/`desc`). Clicking a header toggles direction; clicking a different column switches the sort column. Purely visual columns (status/EDO badges) are not sortable.
- **Per-table default sorts** (applied when no `sort` param is present):
  - **Clients** → `moeosbb_user_id` ascending, with rows having no MoeOSBB id sorted last. (Changes the prior "by name" default.)
  - **Payments** → `payment_date` descending (newest first).
  - **Acts** → `act_date` descending, then `number`.
- Pagination and sort params survive alongside filter/search params and reset appropriately (changing a filter resets to page 1).

## Capabilities

### Modified Capabilities

- `data-tables`: add server-side pagination (25/50/100) and column sorting to the cross-cutting table behavior.

<!-- Per-table default sort values are also reflected in clients/payments/acts list specs by the table-search-filters change, which rewrites those list requirements. This change owns the generic mechanism. -->

## Impact

- **Changed:** `/clients`, `/payments`, `/acts` `page.tsx` — add `count(*)` + `LIMIT/OFFSET` + dynamic `ORDER BY` derived from `(sort, dir)` against an allow-list of sortable columns (no raw column interpolation); remove `.limit(500)`.
- **New code:** `app/components/data-table/` — `Pagination` (page-size select + pager) rendered in the footer slot, and `SortableHeader` (header button + icon) used by the three tables; a small `lib/data-tables/` pure helper to parse/validate `page`/`perPage`/`sort`/`dir` against per-table allow-lists and defaults.
- **DB:** no migration. Sorting on `clients.moeosbb_user_id` (unique, indexed) and the existing `payments_payment_date_idx` / acts date ordering is index-backed; new sort columns without an index are acceptable at current volumes (note any that warrant an index in the design).
- **Cost note:** pagination adds one `count(*)` per page load per surface; acceptable at expected volumes. Documented as a known trade-off (offset pagination) rather than keyset.
- **Tests:** unit tests for the `(sort, dir, page, perPage)` parser/validator (allow-list enforcement, defaults, clamping, page-1 reset); integration smoke that page 2 returns the next slice and total count is correct.
- **PRD coverage:** FR-UI-06 (acts list), FR-PAY-01 (payments list), FR-CLI-09 (clients list) — pagination/sort dimension.

## Real behavior proof

To be captured at implementation time: verification log showing `?perPage=25&page=2&sort=amount&dir=desc` returning the expected slice/order with a correct total count, plus a screenshot of the pinned footer pager and an active sort icon in a column header.

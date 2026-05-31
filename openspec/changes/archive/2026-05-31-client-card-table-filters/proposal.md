## Why

The client card (`/clients/[id]`) has two embedded tables — Платежі and Акти — that currently render every related row with no filtering. For an active client this list can get long, and the operator wants the same date-based slicing they have on the main surfaces ("show me this client's acts from last quarter"). The `clients` spec for the card is also stale: it still describes the Платежі/Акти tabs as "з'являться у Slice 6/8" stubs, although real tables now exist (`client-related.tsx`).

This change adds the **same date-range filter** to the two in-card tables and brings the card spec in line with reality. Per the requirements, these tables need **no search** and **no pagination** (per-client volume is small) — only the date filters.

Depends on: `table-search-filters` (reuses the `DateRangeFilter` component and `lib/data-tables/date-ranges.ts`).

## What Changes

- Add a **date-range filter** to the Платежі tab (on `payment_date`) and the Акти tab (on `act_date`) of the client card, reusing the `DateRangeFilter` presets (today / this & last week / this & last month / this & last quarter) + custom from/to, default no filter, Europe/Kyiv, week-starts-Monday — identical semantics to the main lists.
- **No search box** and **no pagination** on these tables (small per-client volume).
- Each tab's filter is independent and applies only within that client card.
- Update the `clients` "Client card with tabs" requirement to describe the **real** Платежі / Акти tables (replacing the obsolete "з'являться у Slice 6/8" stub wording) and the new per-tab date filter.

## Capabilities

### Modified Capabilities

- `clients`: the client card's Платежі and Акти tabs gain a date-range filter (no search, no pagination); the requirement is updated to reflect the real embedded tables.

## Impact

- **Changed:** the client-card related-tables component (`app/(dashboard)/clients/[id]/client-related.tsx`) gains the date filter; the card page/tab plumbing carries the per-tab date param.
- **Reused:** `DateRangeFilter` and `resolvePeriod` from `table-search-filters`; the date is applied either by re-querying with a `where` on `payment_date`/`act_date` or by filtering the already-loaded per-client arrays (design records the choice — given small volume, client-side filtering of the preloaded rows is acceptable and instant).
- **DB:** no migration. If filtering server-side, reuse existing date indexes; if client-side, no query change.
- **Tests:** unit coverage already exists for `resolvePeriod` (from `table-search-filters`); add a small test/asserts for the per-tab filter wiring if server-side.
- **PRD coverage:** FR-CLI-10 (client card) — adds the date-filter dimension to the related tables; corrects stale spec wording.

## Real behavior proof

To be captured at implementation time: screenshot of a client card with the Акти tab filtered by a date preset (showing a reduced row set) and the Платежі tab with its own independent filter.

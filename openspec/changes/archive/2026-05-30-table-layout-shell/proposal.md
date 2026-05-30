## Why

The three list surfaces (`/clients`, `/payments`, `/acts`) scroll as ordinary documents: the top-bar, page heading, toolbar, and table header all scroll away, and on long lists the operator loses both the column headers and the action buttons. There is also no shared table chrome — each page hand-rolls its own `<table>` markup, so any cross-cutting behavior (sticky header, pagination footer, loaders, full-row click) would have to be built three times.

This change establishes the **foundation**: a fixed-viewport dashboard shell where only the table body scrolls, plus a small set of reusable data-table primitives that the later table proposals (`table-pagination-sorting`, `table-search-filters`) build on. No data-query semantics change here — the same rows are fetched and filtered as today; this is structure and interaction only.

It is the first link in a 5-change initiative:

```
A table-layout-shell  ← this change (foundation)
├─ B table-pagination-sorting
├─ C table-search-filters
│   └─ E client-card-table-filters
└─ D clients-readiness-indicator  (independent)
```

## What Changes

- **Fixed-viewport dashboard layout.** `app/(dashboard)/layout.tsx` becomes a `h-screen`/`overflow-hidden` flex column: a sticky top-bar (fixed height), then a per-page region that owns its own sticky chrome. The document itself no longer scrolls.
- **Sticky page chrome.** On each list page the heading + primary action button + toolbar (search, filter chips) become a sticky header that stays put while the table body scrolls underneath. The table's `<thead>` is `sticky top-0` within the scroll container, so column labels never leave the viewport.
- **Internal table scroll + footer slot.** The table body is the only scroll region (`flex-1 overflow-auto`); a sticky footer slot is reserved at the bottom of every list page for the pagination control that `table-pagination-sorting` will fill. The footer never scrolls out of view.
- **Shared data-table primitives.** Introduce a small `DataTable` shell (`app/components/data-table/`) — scroll container, sticky `<thead>`, body, sticky footer slot, empty-state — that `clients`/`payments`/`acts` tables adopt, replacing their bespoke `<table>` wrappers. No behavioral change to columns yet.
- **Full-row navigation everywhere.** Payments and acts rows become fully clickable (whole row → detail), with a hover affordance, matching the existing clients behavior. The current date-cell-only `<Link>` is removed. Row click keeps middle-click / ⌘-click "open in new tab" working.
- **Loading states.** Each list route gets a `loading.tsx` (route-level Suspense) plus an in-table pending treatment, so navigating or re-querying shows a skeleton/spinner instead of a frozen page.

Queue (`/queue`) and settings pages are out of scope and keep their current layout (queue is explicitly "leave as is").

## Capabilities

### New Capabilities

- `data-tables`: Cross-cutting behavior for the operator's list surfaces (`/clients`, `/payments`, `/acts`) — the fixed-viewport sticky shell, full-row navigation, and loading states. Later changes extend this capability with pagination, sorting, search, filters, and persistence.

### Modified Capabilities

<!-- None. Per-table list requirements (clients/payments/acts) are not re-specified here; full-row navigation is captured generically in data-tables. -->

## Impact

- **New code:** `app/components/data-table/*` (shell components); `app/(dashboard)/{clients,payments,acts}/loading.tsx`.
- **Changed:** `app/(dashboard)/layout.tsx` (fixed-viewport flex column); the three list `page.tsx` + their table components adopt the shell and sticky chrome; `payments`/`acts` rows become full-row links (drop date-only `<Link>`).
- **No DB changes, no migrations, no query changes, no external API calls.** Same rows fetched as today (payments/acts still `.limit(500)` until `table-pagination-sorting` lands).
- **Design tokens:** sticky surfaces, hover affordance, and skeletons use existing semantic tokens (`bg-card`, `bg-muted`, `text-muted-foreground`, `border-border`) per DESIGN.md — no hex/ad-hoc shades.
- **Risk:** this is the highest-risk change of the five (cross-cutting CSS that restructures every dashboard page). Sequenced first and merged in isolation so the layout can be verified before pagination/search logic is layered on.
- **A11y:** full-row click keeps a real focusable link per row (keyboard + new-tab); sticky regions preserve scroll-into-view of focused rows.

## Real behavior proof

To be captured at implementation time: Chrome DevTools MCP screenshots of `/clients`, `/payments`, `/acts` at a short and a tall viewport showing (a) top-bar + heading + table header pinned while the body scrolls, (b) footer slot pinned at the bottom, and (c) a full-row hover + click landing on the detail page.

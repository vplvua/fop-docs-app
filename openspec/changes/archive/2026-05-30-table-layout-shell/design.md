# Design — table-layout-shell

## Context

Today `app/(dashboard)/layout.tsx` is `min-h-screen` with a non-sticky `TopBar` and a `max-w-6xl … py-8` main; the page scrolls as one document. To make "only the table body scrolls" possible, the layout must own the viewport height and delegate a single scroll region to the table.

## Goals / Non-goals

- **Goals:** fixed-viewport shell; sticky top-bar, page chrome, and `<thead>`; reserved sticky footer slot; reusable `DataTable` primitives; full-row navigation; loading states.
- **Non-goals:** pagination logic, sorting, search/filter changes, per-table column changes. Those land in B/C. Queue and settings layouts are untouched.

## Layout model

```
app/(dashboard)/layout.tsx
└── div.h-screen.overflow-hidden.flex.flex-col
    ├── <TopBar/>                      sticky chrome, fixed height (h-14)
    └── <main class="flex-1 min-h-0 flex flex-col">   ← min-h-0 lets the child scroll
        └── {children}                 each list page is a flex column:
            ├── header  (sticky, shrink-0)   heading + action + toolbar
            ├── DataTable scroll region (flex-1 min-h-0 overflow-auto)
            │     thead  sticky top-0
            │     tbody  (the only thing that scrolls)
            └── footer  (sticky bottom, shrink-0)  pagination slot
```

Key CSS facts that make this work (and are easy to get wrong):

- The flex parent needs `min-h-0` on every level that must allow a scrolling child, otherwise the body refuses to shrink and the whole page scrolls instead.
- `sticky top-0` on `<thead>` works only when the scroll container is the `overflow-auto` ancestor (the table itself, not the window). Background on `<thead>` must be opaque (`bg-card`/`bg-muted`) so rows don't bleed through while scrolling.
- The footer is a sibling of the scroll region inside the page flex column (not `position: fixed`), so it spans exactly the content width and never overlaps the body.

## DataTable primitives (`app/components/data-table/`)

A thin, unopinionated shell — not a TanStack-style data grid. It owns structure, not data:

- `DataTablePage` — the page-level flex column (sticky `header` slot, scroll region, sticky `footer` slot). Props: `header`, `footer`, `children`.
- `DataTable` / `DataTableHead` / `DataTableBody` — semantic `<table>` wrappers with the sticky `<thead>` and shared cell paddings/typography lifted from the current three copies.
- `DataTableEmpty` — the existing "нічого не знайдено" centered empty state.
- `RowLink` — makes a `<tr>` behave as a navigation target while keeping an accessible anchor.

These replace the per-page `<div class="overflow-x-auto rounded-lg border">…<table>` blocks. Columns/cells stay defined in each page (clients/payments/acts) — the shell does not abstract columns yet, to keep the diff reviewable.

## Full-row navigation

Clients already do this via a client-component row with `router.push`. Generalize the pattern but keep a **real `<a>`** so middle-click / ⌘-click / keyboard work and it's not a JS-only click:

- Render an invisible full-cell `<Link>` overlay (or wrap the row's primary cell) so the whole row is a hit target, `cursor-pointer`, `hover:bg-accent/50`.
- Interactive children that must not trigger navigation (future row actions, badges with their own links) call `stopPropagation`. None exist on these rows today.
- Decision: prefer the **overlay-anchor** approach over `onClick: router.push` so SSR links remain crawlable/focusable and new-tab works without custom key handling.

## Loading states

- Route-level `loading.tsx` per list page renders the sticky chrome immediately with a skeleton table body (so the shell doesn't reflow when data arrives).
- For in-place re-queries (search/filter navigations introduced in C), the toolbar will drive a `useTransition` pending flag; the shell exposes a `pending` affordance (dimmed body + spinner) that C wires up. A reserves the prop; C uses it.

## Alternatives considered

- **`position: fixed` header/footer with body padding.** Rejected — brittle with the `max-w-6xl` centered content and horizontal scroll; flex + sticky composes better and keeps widths automatic.
- **Window-level scroll with `position: sticky` thead.** Rejected — sticky thead against the window makes the footer pagination scroll away, which violates "pagination always visible".
- **Adopt a table library (TanStack Table).** Rejected — it shines at client-side sort/filter/paginate over already-loaded rows, but the product requires search/filter/paginate across the **entire** dataset (server-side). A client grid would fight the server-driven URL model the app already uses.

## Risks

- Cross-cutting layout change touches every dashboard page; a missing `min-h-0` produces a double scrollbar. Mitigated by shipping A alone and verifying each page before B/C.
- Sticky `<thead>` + horizontal overflow (`overflow-x-auto`) interaction: keep one scroll container that scrolls both axes, or the sticky header detaches. Verify on narrow viewports.

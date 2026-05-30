## 1. Fixed-viewport shell

- [ ] 1.1 Rework `app/(dashboard)/layout.tsx` into a `h-screen overflow-hidden flex flex-col` column: sticky `<TopBar/>` (fixed `h-14`) + `<main class="flex-1 min-h-0 flex flex-col">`; keep `max-w-6xl` centering on the inner content
- [ ] 1.2 Verify the document no longer scrolls (only the table body will) and the top-bar stays pinned

## 2. DataTable primitives (`app/components/data-table/`)

- [ ] 2.1 `DataTablePage` — page-level flex column with sticky `header` slot, `flex-1 min-h-0 overflow-auto` scroll region, and sticky `footer` slot (shrink-0); accept `header`, `footer`, `children`, and a `pending?` flag (used by C)
- [ ] 2.2 `DataTable` / `DataTableHead` / `DataTableBody` — semantic table wrappers; `<thead>` `sticky top-0` with opaque `bg-muted`; lift shared cell padding/typography from the current clients/payments/acts copies
- [ ] 2.3 `DataTableEmpty` — centered empty-state (reuse current "не знайдено" copy per page)
- [ ] 2.4 `RowLink` — overlay-anchor pattern that makes a `<tr>` a full-row navigation target while keeping a real focusable `<a href>` (middle-click / ⌘-click / keyboard work); `cursor-pointer` + `hover:bg-accent/50`
- [ ] 2.5 Use DESIGN.md semantic tokens only (no hex / ad-hoc shades)

## 3. Adopt the shell on the three list pages

- [ ] 3.1 `/clients`: wrap heading + `ClientsToolbar` in the sticky header slot; move `ClientsTable` into `DataTablePage`; keep existing full-row click (re-express via `RowLink`)
- [ ] 3.2 `/payments`: adopt shell; convert rows to full-row navigation via `RowLink` (remove the date-cell-only `<Link>`); add hover affordance
- [ ] 3.3 `/acts`: adopt shell; convert rows to full-row navigation via `RowLink` (remove the date-cell-only `<Link>`); add hover affordance
- [ ] 3.4 Reserve the sticky footer slot on all three pages (empty for now; filled by `table-pagination-sorting`)

## 4. Loading states

- [ ] 4.1 Add `loading.tsx` for `/clients`, `/payments`, `/acts` rendering the sticky chrome + a skeleton table body (no layout reflow when data arrives)

## 5. Verification

- [ ] 5.1 `npm run qa` — 6/6 gates green (lint, format:check, typecheck, test:run, build, openspec validate)
- [ ] 5.2 `npx openspec validate table-layout-shell --strict` passes
- [ ] 5.3 Manual smoke (**human-gated**, requires `.env.local` + `npm run dev`): on each of the three pages confirm top-bar + heading + toolbar + `<thead>` stay pinned while the body scrolls, the footer slot stays pinned, and a full-row hover + click (incl. ⌘-click → new tab) lands on the detail page; check a narrow viewport for sticky-header/horizontal-scroll correctness
- [ ] 5.4 Capture Real-behavior-proof screenshots (Chrome DevTools MCP) for the PR

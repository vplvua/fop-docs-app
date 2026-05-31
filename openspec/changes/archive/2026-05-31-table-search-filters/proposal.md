## Why

Search and filtering across the three list surfaces is inconsistent and incomplete:

- **Clients** search covers `name` + `legal_id` but not MoeOSBB id, and fires a server round-trip on every keystroke with no debounce or loader.
- **Payments** search covers `purpose` + `payer_name`, but there is no date filter at all, and no way to search by the linked client's MoeOSBB id.
- **Acts** search runs against `service_description` (not the client name the operator actually looks for), there is no date filter and no service-type filter wired to the UI, and the amount column repeats "грн" in every cell.

There is also no way to clear all filters at once, no visible indication of which filters are active, and filters are lost when navigating away via the top menu. The `payments`/`acts` specs already call for "period (date range)" and "client" filters that were never implemented — this change delivers them.

Depends on: `table-layout-shell` (toolbar chrome, pending affordance). Composes with `table-pagination-sorting` (shares URL params; filter changes reset to page 1).

## What Changes

**Cross-cutting (`data-tables`):**

- **Debounced server-backed search** (~300 ms) with a visible pending/loader state, replacing per-keystroke navigation. Search always queries the full dataset under the active filters and resets to page 1.
- **Reusable date-range filter** with presets: Сьогодні, Цей тиждень, Минулий тиждень, Цей місяць, Минулий місяць, Цей квартал, Минулий квартал, plus a custom **from/to** range. Default = no date filter. Week/month/quarter boundaries are computed in **Europe/Kyiv**, week starting Monday.
- **Reset-all-filters** control that clears search + every filter (returns the surface to its default view).
- **Active-filter visibility**: applied filters are shown as removable chips / highlighted controls so the operator can see at a glance what is constraining the list.
- **Filter persistence**: the URL is the source of truth (back/forward restores state); the top-nav links to Clients/Payments/Acts remember the last query used for that section, so returning via the menu does not silently drop active filters. Filters do **not** bleed across sections (a date filter on Payments never applies to Acts).

**Per-table:**

- **Clients** — search adds **MoeOSBB id**; search targets become `name` (substring) + `legal_id` (prefix) + `moeosbb_user_id`. Spec aligned with pagination + the new default sort.
- **Payments** — search by **payer name** + **linked MoeOSBB id** (via `payments.client_id` → `clients`; matches only classified/linked payments, a documented limitation); add the date-range filter on `payment_date`.
- **Acts** — search by **client name via JOIN on the current client** (`acts.client_id` → `clients.name`) + **MoeOSBB id**, replacing the `service_description` search; add the date-range filter on `act_date`; add a **service-type filter** (sms / access); **drop the per-cell "грн"** — the amount column shows the number with the unit in the header (`Сума, ₴`) and a thousands separator. Payment amounts are formatted consistently.

## Capabilities

### Modified Capabilities

- `data-tables`: add debounced search, reusable date-range filter, reset-all, active-filter visibility, and filter persistence.
- `clients`: list search includes MoeOSBB id; aligned with pagination and the MoeOSBB-id default sort.
- `payments-ingest`: payments list gains payer/MoeOSBB-id search and a date-range filter.
- `acts`: acts list search targets the current client (name + MoeOSBB id) via join, gains date-range and service-type filters, and drops the per-cell currency suffix.

## Impact

- **Changed:** `/clients`, `/payments`, `/acts` `page.tsx` + toolbars — new `where` construction (joins for payments/acts MoeOSBB id and acts client name; `ilike` search; date-range translation); acts amount cell rendering.
- **New code:** `app/components/data-table/` — `SearchInput` (debounced, pending-aware), `DateRangeFilter` (presets + custom), `ResetFilters`, `ActiveFilters` chips; `lib/data-tables/date-ranges.ts` (pure: preset → `{from,to}` in Europe/Kyiv, week-starts-Monday); a small nav-memory store so top-menu links restore the last per-section query.
- **DB:** no migration. Payments/acts MoeOSBB-id and acts client-name search require a join to `clients` (indexed `moeosbb_user_id` unique; `clients.name` — substring search not index-backed, acceptable at volume). Date filters use existing `payment_date` / `act_date` indexes.
- **Tests:** unit tests for `date-ranges` (each preset's boundaries in Europe/Kyiv incl. quarter math and DST edges) and for `where`-builders; integration smoke that payments date presets and acts client-name/service filters return the right rows.
- **PRD coverage:** FR-CLI-09 (clients search), FR-PAY-01 (payments list filters), FR-UI-06 (acts list filters). Delivers the previously-unimplemented "period (date range)" / "client" filters named in the payments and acts specs.
- **Known limitation:** searching payments by MoeOSBB id only matches payments already linked to a client (`client_id` set after classification); unlinked payments won't surface by id. Stated in the spec.

## Real behavior proof

To be captured at implementation time: verification log showing (a) an acts query filtered by `service_type=access` + this-month date preset returning the right rows, (b) a payments search by linked MoeOSBB id, and (c) a screenshot of active-filter chips + the reset-all control, and the debounced search spinner.

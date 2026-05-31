# Design — table-search-filters

## URL params (extend the table contract)

| Param          | Surfaces       | Meaning                                                                                                               |
| -------------- | -------------- | --------------------------------------------------------------------------------------------------------------------- |
| `q`            | all            | debounced search text                                                                                                 |
| `from` / `to`  | payments, acts | custom date range (ISO `YYYY-MM-DD`, Europe/Kyiv)                                                                     |
| `period`       | payments, acts | preset key: `today` \| `this_week` \| `last_week` \| `this_month` \| `last_month` \| `this_quarter` \| `last_quarter` |
| `service_type` | acts           | `sms` \| `access`                                                                                                     |

`period` and `from`/`to` are mutually exclusive — selecting a preset clears custom dates and vice-versa. Existing filter params (`status`, `source`, `edo`) are unchanged. Any filter/search change drops `page` (resets to page 1, per `table-pagination-sorting`).

## Date-range presets (`lib/data-tables/date-ranges.ts`)

Pure function `resolvePeriod(preset, now) → { from, to }` (inclusive dates), computed in **Europe/Kyiv**, **week starts Monday**:

- `today` → [today, today]
- `this_week` → [Monday of current week, today] (or full week — **decision: Monday…Sunday of the current week**, so it reads as a calendar week, not "week to date")
- `last_week` → previous Monday…Sunday
- `this_month` / `last_month` → calendar month bounds
- `this_quarter` / `last_quarter` → calendar quarter bounds (Q1 Jan–Mar … Q4 Oct–Dec)

`now` is injected (the app forbids `Date.now()` in some contexts and it keeps the function testable). Translation to SQL: `payment_date`/`act_date` are `date` columns, so compare `>= from AND <= to` as date strings — no timezone skew on the column itself; Kyiv only governs which calendar day "today"/boundaries fall on.

Custom `from`/`to`: either bound optional (open-ended range allowed). Invalid dates ignored.

## Per-table search/`where` construction

- **Clients:** `ilike(name, %q%)` OR `ilike(legal_id, q%)` OR (`q` is all-digits → `cast(moeosbb_user_id as text) like %q%`). Filters: status/source/edo unchanged.
- **Payments:** join `clients` on `payments.client_id`. Search = `ilike(payer_name, %q%)` OR `ilike(purpose, %q%)` OR (`q` all-digits → `cast(clients.moeosbb_user_id as text) like %q%`). The MoeOSBB-id branch only matches linked payments (`client_id` set); documented limitation. Date filter on `payment_date`.
- **Acts:** join `clients` on `acts.client_id`. Search = `ilike(clients.name, %q%)` OR (`q` all-digits → `cast(clients.moeosbb_user_id as text) like %q%`) — replaces the `service_description` search. Filters: status (existing), `service_type` (new: sms/access), edo (existing), date on `act_date`.

**Decision (acts search target):** match the **current** client via join, not the frozen `client_snapshot.name`. Rationale: consistent with MoeOSBB-id search (id lives only on `clients`), and the operator searches by who the client _is now_. Acts whose `client_id` is unset would not match by name — acceptable (acts always carry a client).

MoeOSBB-id detection: treat `q` as an id query when it is all digits; run it as an additional OR branch so a numeric string still also matches names/purpose where relevant. The id branch is a substring match on the id cast to text (`cast(... as text) like %q%`), so partial ids behave like the name search rather than requiring an exact value.

## Debounced search component

`SearchInput` (client): debounce ~300 ms, then `router.replace` (not `push`, to avoid history spam per keystroke) with updated `q`, dropping `page`. Shows a small spinner while the navigation transition is pending (`useTransition`), feeding the shell's `pending` affordance from `table-layout-shell`.

## Active filters + reset

- `ActiveFilters`: derives chips from the current params (status, source, edo, period/custom range, service_type, q). Each chip has an ✕ that removes just that param. Default-state params render no chip.
- `ResetFilters`: visible when any non-default param is set; clears all of them (search + filters), keeping the surface (and its default sort/page size).

## Filter persistence (URL + nav memory)

- **Within a surface:** URL is the source of truth; back/forward and detail→back restore filters for free.
- **Across the top menu:** a tiny client store (e.g. `sessionStorage` keyed by section) records the last full query string for `/clients`, `/payments`, `/acts`. The nav links read it so clicking "Платежі" returns to the last filtered Payments view rather than a bare list.
- **No cross-section bleed:** each section's memory is independent; a Payments date filter never appears on Acts. (Chosen over a shared global filter store, which would be surprising.)

## Amount formatting

- Acts amount column header → `Сума, ₴`; cell → number only, thousands-separated (`12 500,00`), no per-cell "грн". Payments amount formatted the same way for consistency (currently a raw string). Shared `formatAmount` helper.

## Out of scope

- Per-section persistence across browser sessions/devices (we use `sessionStorage`, not a DB-backed preference). Client-card tab filters are a separate change (`client-card-table-filters`) that reuses `DateRangeFilter`.

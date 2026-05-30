## 1. Date-range util (`lib/data-tables/date-ranges.ts`)

- [ ] 1.1 Pure `resolvePeriod(preset, now) → { from, to }` for today / this-week / last-week / this-month / last-month / this-quarter / last-quarter, computed in Europe/Kyiv, week starting Monday; `now` injected
- [ ] 1.2 Custom range support (optional `from`/`to`, open-ended allowed, invalid ignored)
- [ ] 1.3 Unit tests `tests/unit/data-tables/date-ranges.test.ts` — each preset's boundaries (incl. quarter math, month lengths, week-start-Monday, year/quarter rollover)

## 2. Shared filter components (`app/components/data-table/`)

- [ ] 2.1 `SearchInput` — debounced (~300 ms) `router.replace`, drops `page`, `useTransition` spinner feeding the shell `pending` affordance
- [ ] 2.2 `DateRangeFilter` — preset dropdown + custom from/to; preset and custom are mutually exclusive; default "без фільтра"
- [ ] 2.3 `ResetFilters` — visible when any non-default param set; clears search + all filters
- [ ] 2.4 `ActiveFilters` — chips for active params (status/source/edo/period/range/service_type/q) each individually removable
- [ ] 2.5 Nav-memory store (sessionStorage per section) + top-nav links restore last query for `/clients`, `/payments`, `/acts`; no cross-section bleed
- [ ] 2.6 `formatAmount` helper — thousands-separated `12 500,00`

## 3. Clients

- [ ] 3.1 Add MoeOSBB-id branch to clients search (`q` all-digits → `moeosbb_user_id = q`), alongside name substring + legal_id prefix; debounced via `SearchInput`
- [ ] 3.2 Wire `ResetFilters` + `ActiveFilters`

## 4. Payments

- [ ] 4.1 Join `clients` on `payments.client_id`; search = payer_name/purpose substring OR linked `moeosbb_user_id`; document the linked-only limitation
- [ ] 4.2 Add `DateRangeFilter` on `payment_date` (presets + custom); reset/active-filter chips; format amount

## 5. Acts

- [ ] 5.1 Join `clients` on `acts.client_id`; replace `service_description` search with current client name + MoeOSBB id
- [ ] 5.2 Add `service_type` filter (sms / access) and `DateRangeFilter` on `act_date`; reset/active-filter chips
- [ ] 5.3 Amount column: header `Сума, ₴`, cell = `formatAmount` number, drop per-cell "грн"

## 6. Verification

- [ ] 6.1 `npm run qa` — 6/6 gates green
- [ ] 6.2 `npx openspec validate table-search-filters --strict` passes
- [ ] 6.3 Integration smoke (real Neon test DB): acts filtered by `service_type=access` + this-month preset; payments by linked MoeOSBB id; acts by current client name
- [ ] 6.4 Manual smoke (**human-gated**): debounced search shows spinner; date presets + custom range constrain results; reset clears everything; active-filter chips removable; returning via top menu restores last filter; no per-cell "грн" on acts
- [ ] 6.5 Capture Real-behavior-proof (verification log of filtered queries + screenshot of chips/reset/spinner)

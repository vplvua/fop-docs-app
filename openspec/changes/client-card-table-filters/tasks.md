## 1. In-card date filters

- [ ] 1.1 Add `DateRangeFilter` (reused from `table-search-filters`) above the Платежі tab table, filtering on `payment_date`; default no filter
- [ ] 1.2 Add `DateRangeFilter` above the Акти tab table, filtering on `act_date`; default no filter
- [ ] 1.3 Carry each tab's date selection in the card's tab/param plumbing; keep the two filters independent and scoped to the card
- [ ] 1.4 Apply the filter (decision per design: client-side filtering of the preloaded per-client rows given small volume, or a scoped re-query); no search box, no pagination on these tables

## 2. Spec alignment

- [ ] 2.1 Ensure the card renders the real Платежі / Акти tables (already implemented) — remove any remaining "з'являться у Slice 6/8" stub copy if present

## 3. Verification

- [ ] 3.1 `npm run qa` — 6/6 gates green
- [ ] 3.2 `npx openspec validate client-card-table-filters --strict` passes
- [ ] 3.3 Manual smoke (**human-gated**): open a client with many payments/acts, apply a date preset on each tab, confirm the row set narrows, the two filters are independent, and there is no search/pagination
- [ ] 3.4 Capture Real-behavior-proof screenshot (card tab filtered by a date preset)

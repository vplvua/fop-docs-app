## Context

The manual act form (`/acts/new`) picks a client from a native `<select>` built
from every contract-bearing client, sorted by name. The native control opens
scrolled to the selected option, so the first options can be above the fold and
appear missing; there is no type-to-filter. The list will only grow as more
clients sign contracts. The fix is purely a selection-UX change — the eligible
set, the chosen value, and downstream act/payment creation are unchanged.

The project has no combobox/cmdk/Radix dependency, and DESIGN.md is not yet
wired (stock shadcn grayscale tokens). The existing `SearchInput`
(`app/components/data-table/search-input.tsx`) establishes the search-field
styling and substring-search convention.

## Goals / Non-Goals

**Goals:**

- A searchable client picker on the manual act form, filtering by name, EDRPOU
  and contract number (case-insensitive substring).
- Keyboard and pointer accessible (combobox/listbox semantics, ↑/↓/Enter/Esc,
  outside-click close), styled with existing tokens.
- No new runtime dependency; no DB migration; no API change.

**Non-Goals:**

- Changing client eligibility (still contract-bearing clients only).
- Changing the selected value semantics or act/payment creation.
- Making the client editable in edit mode (it stays read-only).
- A reusable app-wide combobox primitive — this lives with the form for now.

## Decisions

- **Hand-rolled combobox, no library.** A small `ClientCombobox` + `ClientOption`
  in `manual-act-form.tsx`, plain React state (`open`, `query`, `active`).
  Rationale: the only consumer is this one field; adding cmdk/Radix for it would
  be disproportionate. Alternative (shadcn Command/Popover) rejected to avoid a
  new dependency for a single use site.
- **Fetch the contract number alongside the client.** `loadContractClients`
  inner-joins `contracts`; the unique index on `contracts.client_id` guarantees
  at most one contract per client, so a scalar `contractNumber` (not an array)
  is correct. The edit page left-joins and coalesces to `""` so editing still
  works even if a contract was later deleted (the picker is read-only there).
- **Filter client-side over the already-loaded list.** The contract-client list
  is small enough to ship to the client and filter in-memory; reuses the
  substring (not exact) convention, casting the numeric EDRPOU/contract number
  to text. No server round-trip per keystroke.
- **Lint accommodations.** Per-item handlers are bound inside `ClientOption`
  (stable refs) to satisfy `react-perf/jsx-no-new-function-as-prop`; the ARIA
  `role="listbox"`/`role="option"` on `div`s carry justified
  `eslint-disable-next-line jsx-a11y/prefer-tag-over-role` comments (this is an
  ARIA combobox, not a native `<select>`).

## Risks / Trade-offs

- [Whole list shipped to the client] → Acceptable: only contract-bearing clients,
  a bounded set; if it ever grows large, switch to a server-backed search action.
- [Custom combobox a11y/keyboard parity with native select] → Mitigated by
  combobox/listbox roles, focus management, and ↑/↓/Enter/Esc handling; verified
  in-browser (open, filter by name/EDRPOU/contract number, select, close).
- [Edit page join change could hide an act] → Mitigated by using `leftJoin` +
  coalesce instead of `innerJoin`, preserving the original "client fetched
  regardless of contract" behavior.

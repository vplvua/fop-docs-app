## Why

On «Створити акт вручну» the client field is a native `<select>` over every
client that has a contract. That list can be long, and the native control opens
scrolled to the currently-selected option — so the first entries (and the client
the admin is looking for) can sit above the visible area and read as "missing".
Admins reported not finding a client that was in fact present and first in the
list. There is no way to type-filter the list.

## What Changes

- Replace the native client `<select>` on the manual act form with a searchable
  combobox: a trigger showing the chosen client, a focused search box on open,
  and a filtered list with keyboard navigation (↑/↓, Enter, Esc), outside-click
  close, and a "Нічого не знайдено" empty state.
- Filter is a case-insensitive **substring** match over the client name, the
  EDRPOU/РНОКПП (matched as text), and the **contract number** — so an admin can
  find a client by any of the three.
- In edit mode the client stays fixed, so the picker renders as read-only text
  (no behavior change there).
- No change to which clients are eligible (still only clients with a contract),
  to the selected value, or to act/payment creation — this is a selection-UX
  change only.

## Capabilities

### New Capabilities

<!-- none -->

### Modified Capabilities

- `manual-acts`: the "Manual act creation form" requirement gains behavior for
  the client picker — it SHALL be searchable by name, EDRPOU and contract
  number, while still listing only contract-bearing clients.

## Impact

- `app/(dashboard)/acts/new/manual-act-form.tsx` — new `ClientCombobox` +
  `ClientOption` components; `ContractClient` gains `contractNumber`.
- `app/(dashboard)/acts/new/page.tsx` — `loadContractClients` inner-joins
  `contracts` to fetch the contract number (unique index on `contracts.client_id`
  guarantees ≤1 per client).
- `app/(dashboard)/acts/[id]/edit/page.tsx` — left-joins `contracts` and
  coalesces the number (picker is read-only in edit mode).
- No DB migration, no API change, no new dependency (plain React + existing
  lucide icons and design tokens).

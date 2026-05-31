## 1. Data: surface the contract number

- [x] 1.1 Add `contractNumber: string` to the `ContractClient` interface in `app/(dashboard)/acts/new/manual-act-form.tsx`
- [x] 1.2 In `app/(dashboard)/acts/new/page.tsx`, rewrite `loadContractClients` to inner-join `contracts` and select `contracts.number` (drop the two-step `inArray` query; use `eq`)
- [x] 1.3 In `app/(dashboard)/acts/[id]/edit/page.tsx`, left-join `contracts` and coalesce `contractNumber` to `""` (picker is read-only in edit mode); import the `contracts` schema

## 2. UI: searchable combobox

- [x] 2.1 Add a `ClientCombobox` component (trigger button, focused search input on open, filtered listbox, "Нічого не знайдено" empty state) using existing tokens and lucide icons
- [x] 2.2 Filter options by case-insensitive substring over `name`, `legalId` and `contractNumber`; set placeholder to "Пошук за назвою, ЄДРПОУ або № договору…"
- [x] 2.3 Add a `ClientOption` row component with per-item bound handlers (satisfies `react-perf/jsx-no-new-function-as-prop`); add justified `eslint-disable` for the combobox ARIA roles
- [x] 2.4 Wire keyboard (↑/↓ navigate, Enter select, Esc close) and outside-click close
- [x] 2.5 Render the picker read-only when `readOnlyIdentity` (edit mode); replace the native `<select>` and update `onClient` to take an id

## 3. Verification

- [x] 3.1 `npx tsc --noEmit` passes; lint hook clean on the three changed files
- [x] 3.2 In-browser: open the picker, confirm the target client is listed; filter by name, by EDRPOU, and by contract number; select a result and confirm it closes
- [x] 3.3 Run `npm run qa` (lint → format:check → typecheck → test:run → build → openspec validate)
- [x] 3.4 `openspec validate searchable-manual-act-client-picker --strict`

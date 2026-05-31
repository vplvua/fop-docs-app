## 1. Readiness mapper (`lib/clients/readiness.ts`)

- [x] 1.1 Pure `computeReadiness(client, contract)` → `{ level: "red"|"yellow"|"green", missing: string[] }`, reusing `checkCompleteness`: red if no contract or any required client field missing (email/address/bank_name/bank_account); yellow if required complete but `apartments_count` missing and no `access_price_override` (access conditional); green otherwise
- [x] 1.2 Ukrainian labels for each missing item (договір, email, адреса, банк, IBAN, кількість квартир)
- [x] 1.3 Unit tests `tests/unit/clients/readiness.test.ts` — red (no contract), red (missing bank), yellow (missing apartments_count, no override), green (all present), green (access covered by price override)

## 2. Clients list integration

- [x] 2.1 `/clients` query: LEFT JOIN `contracts` (1:1 via unique `client_id`); select the fields completeness needs
- [x] 2.2 Add a readiness column to the clients table: status dot colored via semantic tokens (success/warning/destructive), with a tooltip + accessible label listing the missing items

## 3. Verification

- [x] 3.1 `npm run qa` — 6/6 gates green
- [x] 3.2 `npx openspec validate clients-readiness-indicator --strict` passes
- [ ] 3.3 Manual smoke (**human-gated**): with clients in each state, confirm 🔴 (no contract / missing required), 🟡 (missing apartments_count), 🟢 (ready), and that the tooltip lists the right missing items
- [ ] 3.4 Capture Real-behavior-proof screenshot (three dot states + tooltip)

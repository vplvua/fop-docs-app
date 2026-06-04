## 1. Eligibility & page

- [x] 1.1 Load `payer_name` / `payer_legal_id` on the split page; add a **Платник** line (name + ЄДРПОУ) to the payment summary
- [x] 1.2 Load `transit_edrpou_list` (`getTransitEdrpouList`); compute `isTransit = list.includes(payerLegalId)`
- [x] 1.3 Replace `loadContractClients()` with `loadEligibleClients(payerLegalId | null)` — scope to `clients.legal_id = payerLegalId` for a normal payer, full list for transit (`null`)
- [x] 1.4 Transit-aware intro copy + empty state (name the payer for a non-transit payer with no contract client; generic message for transit)

## 2. Form

- [x] 2.1 Add `payerName` / `payerLegalId` / `isTransit` props to `SplitForm`
- [x] 2.2 Read-only payer banner: «Платник для всіх актів …» (normal) / «Транзитний платник … оберіть клієнта для кожного акту» (transit)
- [x] 2.3 Show the per-line `ClientCombobox` only when `isTransit || clients.length > 1`; otherwise fix every line to the single payer client (`firstClient`)

## 3. Server guard

- [x] 3.1 In `splitPaymentAction`, select `payer_legal_id` and compute `isTransit` from `getTransitEdrpouList`
- [x] 3.2 Reject any line whose `client.legal_id !== payment.payer_legal_id` unless `isTransit` (no acts created, payment status unchanged)

## 4. Quality gate & verification

- [x] 4.1 `npm run typecheck` green; `npm run lint` no errors (pre-existing warnings only)
- [x] 4.2 `npm run test:run` (unit) green; `node scripts/check-design-tokens.mjs` green; `npm run build` green
- [ ] 4.3 Manual dev smoke: a normal payer (e.g. ЄДРПОУ 26206408) shows the fixed-payer form with no picker and creates both acts for that client; a payer EDRPOU with no contract client shows the named empty state; a transit-EDRPOU payment keeps the cross-client picker — capture Real-behavior-proof for the PR

## 1. Pure helpers (`lib/queue/`)

- [x] 1.1 Extract `parseReason` and the `REASON_GUIDANCE` map out of `app/(dashboard)/payments/[id]/classification-panel.tsx` into `lib/queue/reasons.ts` (single source of truth) and re-import them in `classification-panel.tsx`
- [x] 1.2 Add `groupByReason(payments)` in `lib/queue/group.ts` — splits `classification_reason` into `{ key, detail }`, buckets payments by key, and returns groups ordered by a fixed actionability priority (`no_match`, `multiple_clients_same_edrpou`, `client_incomplete`, `multiple_contracts`, `amount_mismatch`, `sms_quantity_mismatch`, `auto_act_disabled`, `external_edo`, legacy `ambiguous_client` last)
- [x] 1.3 Add `computeMissingFields(client, contract, serviceType)` in `lib/queue/missing-fields.ts` — returns ordered missing required fields (`email`, `address`, `bank_name`, `bank_account`, contract; plus `apartments_count` for `access` without `access_price_override`) each with a deep-link target descriptor; pure, no Next.js import
- [x] 1.4 Unit tests `tests/unit/queue/group.test.ts`, `tests/unit/queue/missing-fields.test.ts`, `tests/unit/queue/reasons.test.ts` — cover ordering, reason parsing, and missing-field parity with the classifier completeness rule (D-017)

## 2. Queue route shell (`app/(queue)/queue/`)

- [x] 2.1 Create `app/(queue)/queue/page.tsx` (RSC): read `tab` search param (default `awaiting_review`), query payments by status, join candidate clients for `no_match`/`multiple_clients_same_edrpou`, compute groups via `groupByReason`
- [x] 2.2 Render the two tabs (**На апрув** / **Проблеми класифікації**) reflecting active tab in the URL; render per-reason group sections with heading + count; empty-state message when a tab has no payments
- [x] 2.3 Use DESIGN.md tokens for layout, headings, badges, and cards (no hex/ad-hoc shades); match Ukrainian copy to existing classification strings

## 3. Reason resolution cards (client leaves)

- [x] 3.1 `no_match` card: client search/autocomplete → `linkPaymentClientAction`; "Створити нового клієнта" → link to `/clients/new` prefilled from payer; surface guardrail errors (FR-QUEUE-03)
- [x] 3.2 `multiple_contracts` card: radio-select of `parsed_contract_numbers` as a disambiguation aid + re-run/skip actions (FR-QUEUE-04)
- [x] 3.3 `multiple_clients_same_edrpou` card: warning + active-candidate selector (contract number + Моє ОСББ id), archived hidden, select → `linkPaymentClientAction`; legacy `ambiguous_client` rendered read-only (FR-QUEUE-05)
- [x] 3.4 `client_incomplete` card: render `computeMissingFields` list with deep-links into client/contract fields (FR-QUEUE-06)
- [x] 3.5 `amount_mismatch` / `sms_quantity_mismatch` card: show amount, resolved unit price, implied/parsed quantity + re-run/skip actions (FR-QUEUE-07)
- [x] 3.6 `external_edo` card: "Вчасно" badge + manual-workflow hint (FR-QUEUE-08); `auto_act_disabled` card: guidance + re-run/skip
- [x] 3.7 Shared per-payment "Пропустити" action wired to `skipPaymentAction`; all cards call `router.refresh()` after a successful action so resolved payments leave the group (FR-QUEUE-09, FR-QUEUE-10)

## 4. Navigation

- [x] 4.1 Add "Черга" entry to the shared top-bar linking to `/queue`, with a pending count of `awaiting_review + in_queue` payments (cheap `count(*)` in the top-bar RSC)

## 5. Verification

- [ ] 5.1 E2E (`tests/e2e/queue.spec.ts`) — **deferred**: Playwright is not yet configured in this repo (vitest-only; AGENTS.md notes E2E "з S2+, коли налаштовано"). Every prior Phase 0 slice (S2–S11) shipped with E2E skipped. Queue logic is covered by the `lib/queue/` unit tests and the manual smoke (5.2); a Playwright harness is out of scope for this polish slice.
- [ ] 5.2 Manual smoke on real Neon dev branch (**human-gated**): seed payments across reasons, walk both tabs, confirm grouping/ordering/empty-state and pending count. Requires `.env.local` + `npm run dev`.
- [x] 5.3 `npm run qa` — 6/6 gates green (lint, format:check, typecheck, test:run, build, openspec validate)
- [x] 5.4 `npx openspec validate add-queue-polish --strict` passes
- [x] 5.5 Record demo (`docs/qa/recordings/S12-queue.md`) and update `docs/current-state.md` (phase, last/next slice, matrix, recent activity)

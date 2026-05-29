## 1. Pure helper (`lib/dashboard/`)

- [x] 1.1 Add `deriveHealth(row)` in `lib/dashboard/health.ts` — takes an `IntegrationHealth | undefined`, returns a discriminated state `{ state: "ok" | "error" | "unknown", lastSuccessAt, lastErrorAt, lastErrorMessage }`: `unknown` when no row / never succeeded-or-errored, `error` when `lastErrorAt` is strictly newer than `lastSuccessAt`, `ok` otherwise when `lastSuccessAt` is set; pure, no Next.js import
- [x] 1.2 Add a fixed `DASHBOARD_INTEGRATIONS` list (`privatbank`/`dubidoc`/`moeosbb` → Ukrainian display name) in `lib/dashboard/health.ts` so a never-run service still renders a banner
- [x] 1.3 Unit tests `tests/unit/dashboard/health.test.ts` — cover ok / error (last_error newer) / unknown (no row, success-only, error-only), and timestamp tie-break

## 2. PrivatBank manual button

- [x] 2.1 Create `app/(dashboard)/privatbank-poll-button.tsx` (`'use client'`) wrapping `triggerPrivatbankPollNow` (`app/(dashboard)/payments/actions.ts`); report `inserted`/`total`; mirror the existing `MoeosbbSyncButton` pattern and `router.refresh()` on success

## 3. Dashboard page rewrite (`app/(dashboard)/page.tsx`)

- [x] 3.1 Convert to async RSC: `Promise.all` of `getIntegrationHealth()` and three `count(*)` queries (`payments.status = in_queue`, `payments.status = awaiting_review`, `acts.status = sent_to_edo`)
- [x] 3.2 Render integration health banners from `DASHBOARD_INTEGRATIONS` × `deriveHealth` — ✓/✗/ще-не-запускалось, last-success timestamp, error message + time on failure (FR-UI-01)
- [x] 3.3 Render the three counters as cards linking to `/queue?tab=in_queue`, `/queue?tab=awaiting_review`, `/acts?status=sent_to_edo` (FR-UI-02)
- [x] 3.4 Render the three manual-trigger buttons (new PrivatBank + existing Moe ОСББ + Дубідок) (FR-UI-03); remove the S1 placeholder copy
- [x] 3.5 Use DESIGN.md tokens only (semantic-success / destructive / muted for banner states; no hex/ad-hoc shades); Ukrainian copy consistent with the rest of the app

## 4. Verification

- [x] 4.1 `npm run qa` — 6/6 gates green (lint, format:check, typecheck, test:run, build, openspec validate)
- [x] 4.2 `npx openspec validate add-dashboard-polish --strict` passes
- [ ] 4.3 Manual smoke (**human-gated**): with seeded data + a forced integration error, confirm banners flip ✓/✗, counters match, counter links land on filtered surfaces, and manual triggers refresh the page. Requires `.env.local` + `npm run dev`.
- [ ] 4.4 Record demo (`docs/qa/recordings/S13-dashboard.md`) and update `docs/current-state.md` (phase, last/next slice, matrix, recent activity) — Phase 0 MVP complete after this slice

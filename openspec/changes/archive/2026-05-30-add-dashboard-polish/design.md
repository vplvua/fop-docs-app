## Context

The dashboard at `app/(dashboard)/page.tsx` is the S1 placeholder. Everything S13 needs already exists:

- `lib/observability/index.ts` → `getIntegrationHealth()` returns `IntegrationHealth[]` (`service`, `lastSuccessAt`, `lastErrorAt`, `lastErrorMessage`, `updatedAt`), one row per service, written by every cron (S6 privatbank, S9 dubidoc, S11 moeosbb).
- Payment statuses (`in_queue`, `awaiting_review`) and act statuses (`draft`, `sent_to_edo`, `signed`, `deleted`) are in the schema with indexes (`payments_status_idx`).
- Manual triggers already implemented: `triggerPrivatbankPollNow` (`payments/actions.ts`, returns `{ inserted, total, insertedIds }`), `triggerMoeosbbSyncAction` + `triggerDubidocPollAction` (`dashboard-actions.ts`), with working client buttons `MoeosbbSyncButton` / `DubidocPollButton`.

Constraints: single admin, UA-only copy, Next.js 16 App Router (RSC by default), `lib/` pure, DESIGN.md tokens only (no hex/ad-hoc shades), reuse existing patterns.

## Goals / Non-Goals

**Goals:**

- `/` answers "is everything healthy / what needs me?" at a glance: three integration health banners, three attention counters, three manual triggers.
- Counters are launchpads — each links to its filtered surface (`/queue`, `/acts`).
- Reuse `getIntegrationHealth` and all three trigger actions verbatim; only add the missing PrivatBank button.
- Extract banner health-state derivation into a pure, unit-tested `lib/dashboard/` helper.

**Non-Goals:**

- No DB migration, no new column, no consecutive-failure counter (see Decisions D3), no cron, no external API calls beyond the existing manual triggers.
- No real-time auto-refresh / websockets — RSC render on navigation + button-driven `router.refresh()` is sufficient for a single admin.
- No charts/history — `integration_health` keeps only the latest state; trend views are Phase 1+.
- `/api/health` is untouched (NFR-AVAIL-06).

## Decisions

### D1. RSC page reads everything server-side; buttons are client leaves

`page.tsx` becomes an `async` Server Component: `Promise.all` of `getIntegrationHealth()` and three `count(*)` queries (queued, awaiting-review, acts sent_to_edo). Banners and counters render server-side. The three manual-trigger buttons stay `'use client'` leaves calling the existing server actions and `router.refresh()` (so counters/banners update after a manual run). Mirrors the established dashboard-button pattern.

### D2. Banner health state derived by a pure helper

`deriveHealth(row: IntegrationHealth | undefined)` in `lib/dashboard/health.ts` returns a discriminated state: `unknown` (no row / never ran), `ok` (has `lastSuccessAt` and no `lastErrorAt` newer than it), `error` (has `lastErrorAt` strictly newer than `lastSuccessAt`). The component maps state → token-based styling (semantic-success / destructive / muted) and Ukrainian label. Pure and unit-tested so the ✓/✗ logic is pinned independently of layout. The service list is fixed (`privatbank`, `dubidoc`, `moeosbb`) with display names, so a service that never ran still shows an "ще не запускалось" banner rather than being silently absent.

_Alternative considered:_ compute health inline in the component. Rejected — the timestamp-comparison logic is exactly the kind of thing that should have a test.

### D3. No consecutive-failure counter; banner reflects current error state

FR-PAY-07 mentions "4+ consecutive poll failures". `integration_health` stores only `lastSuccessAt` / `lastErrorAt` / `lastErrorMessage` — no run-by-run counter. Adding one would be a schema change + cron-logic change, out of scope for a UI polish slice. The banner therefore shows the _current_ error state (last_error newer than last_success) plus the message and timestamp, which satisfies FR-UI-01 and the operator-visible intent of FR-PAY-07. Captured as a known limitation in the proposal; a counter can be a Phase 1 follow-up if the literal threshold is required.

### D4. New `dashboard` capability spec

`/` is a distinct surface; it gets its own `dashboard` capability spec. No existing capability's requirements change — the page only _reads_ via `getIntegrationHealth` and the existing trigger actions, whose contracts are unchanged.

### D5. Counters link to filtered surfaces

"Платежів у черзі" → `/queue?tab=in_queue`, "Платежів на апрув" → `/queue?tab=awaiting_review` (the S12 surface), "Актів очікують підпису" → `/acts?status=sent_to_edo`. Makes the dashboard a launchpad and reuses routes that already accept those params.

## Risks / Trade-offs

- **`/` adds 4 queries per render** → Mitigation: all are indexed `count(*)` / a single small table scan; single-admin scale makes this negligible. `getIntegrationHealth` already exists and is used nowhere hot.
- **Banner "ok" can be stale if a cron silently stopped running** → Mitigation: show the last-success timestamp explicitly so a stale ✓ is visually obvious (old date). A freshness threshold is deferred (no requirement for it).
- **Counter ↔ surface drift** (e.g. acts "awaiting signature" definition) → Mitigation: define the counter exactly as `acts.status = 'sent_to_edo'` and link to the same filter; one source of truth in the page.
- **PrivatBank button reuses an action defined under `payments/`** → harmless cross-file import (same pattern the queue slice used for classification actions); no import-boundary rule violated.

## Migration Plan

Pure additive UI slice. Deploy = ship the rewritten page + new button. No DB migration → dev/prod Neon branch divergence irrelevant. Rollback = revert the PR (manual-trigger buttons and all underlying actions are unchanged and keep working).

## Open Questions

- None blocking. Whether to add a real consecutive-failure counter (D3) is a deliberate deferral, not an open question for this slice.

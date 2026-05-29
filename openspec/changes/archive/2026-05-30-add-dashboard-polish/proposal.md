## Why

The dashboard (`/`) is still the S1 placeholder: a "підключіть інтеграції" card plus two manual-action buttons (Дубідок poll, Моє ОСББ sync). All the data needed for an operational home screen now exists — `integration_health` (written by every cron since S6/S9/S11), payment statuses, and act statuses — but nothing surfaces it. S13 turns `/` into the real operator landing page: in 5 seconds the admin should see which integrations are alive, how many payments need attention, and which acts are stuck.

## What Changes

- Dashboard (`/`) renders **integration health banners** for ПриватБанк, Дубідок, and "Моє ОСББ": ✓/✗ state derived from `integration_health`, with the last-success timestamp and, on failure, the last error message + time. (FR-UI-01)
- Dashboard shows **counters**: "Платежів у черзі" (`in_queue`), "Платежів на апрув" (`awaiting_review`), "Актів очікують підпису" (`sent_to_edo`). (FR-UI-02)
- Dashboard exposes all three **manual-action buttons**: "Синхронізувати ПриватБанк зараз" (new — reuses `triggerPrivatbankPollNow`), "Синхронізувати Моє ОСББ зараз" (existing), "Опитати статуси Дубідок" (existing). (FR-UI-03)
- Counters link through to the relevant filtered surfaces (`/queue?tab=in_queue`, `/queue?tab=awaiting_review`, `/acts?status=sent_to_edo`) so the dashboard is a launchpad, not a dead end.
- The placeholder copy and "Slice 13" note are removed.

UI/UX polish only — no DB migrations (the `integration_health` table exists since Phase 0 setup), no new cron, no external API calls beyond the manual triggers that already exist.

## Capabilities

### New Capabilities

- `dashboard`: The operator home screen at `/` — integration health banners sourced from `integration_health`, attention counters (queued / awaiting-review payments, acts awaiting signature), and the three manual integration triggers, with counters linking to their filtered surfaces.

### Modified Capabilities

<!-- None. Reuses existing server actions (triggerPrivatbankPollNow, triggerMoeosbbSyncAction, triggerDubidocPollAction) and lib/observability.getIntegrationHealth without changing their contracts. -->

## Impact

- **New code:** `app/(dashboard)/page.tsx` rewritten (RSC: reads `getIntegrationHealth` + count queries); `app/(dashboard)/privatbank-poll-button.tsx` (new client button); a small `lib/dashboard/` pure helper for deriving banner health state from an `IntegrationHealth` row.
- **Reused, unchanged:** `lib/observability.getIntegrationHealth`; `triggerPrivatbankPollNow` (`app/(dashboard)/payments/actions.ts`); `triggerMoeosbbSyncAction` / `triggerDubidocPollAction` (`app/(dashboard)/dashboard-actions.ts`); existing `DubidocPollButton` / `MoeosbbSyncButton`.
- **No DB changes, no migrations, no new cron, no external API calls.**
- **Tests:** unit tests for the banner health-state helper and counter labels; manual smoke (human-gated).
- **PRD coverage:** FR-UI-01..03; surfaces the display half of FR-PAY-07 / FR-SYNC-04 (health banner + manual sync). NFR-AVAIL-06 unchanged (`/api/health` not touched).
- **Known limitation:** `integration_health` stores only last-success / last-error, not a consecutive-failure counter, so the banner reflects _current_ error state (last_error newer than last_success) rather than the literal "4+ consecutive" wording of FR-PAY-07. No schema change in this polish slice.

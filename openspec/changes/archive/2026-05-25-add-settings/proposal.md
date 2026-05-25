## Why

The classifier (S7) needs configurable parameters: regex patterns for parsing contract numbers from payment purposes, SMS keywords for service-type detection, and transit EDRPOU list for bypassing two-factor matching. Without these, the classifier cannot run. Additionally, polling/sync intervals need to be admin-configurable. S4 (tariffs) already created the settings layout with sidebar nav — this slice extends it with the remaining settings pages.

## What Changes

- New `settings` table — generic key-value store with `key TEXT PRIMARY KEY`, `value JSONB`, `updated_at`.
- Seed data: 5 starter regex patterns (from PRD § 4.2), SMS keywords `["смс", "sms", "повідомлення"]`, transit EDRPOU list `["14360570"]`, polling intervals (`privatbank_polling_interval_minutes=60`, `dubidoc_poll_interval_hours=6`, `moeosbb_sync_schedule="first"`).
- Domain: `lib/settings/` with typed getters/setters for each setting key.
- UI pages under the existing settings layout:
  - `/settings/patterns` — CRUD regex patterns with live test-area (FR-SET-03).
  - `/settings/sms-keywords` — simple list add/remove (FR-SET-04).
  - `/settings/transit-edrpou` — simple list add/remove (FR-SET-05).
  - `/settings/integrations` — read-only integration status panel with editable intervals (FR-SET-06, FR-SET-07).
- Sidebar nav updated with new entries.

## Capabilities

### New Capabilities

- `settings`: Classifier settings CRUD (regex patterns, SMS keywords, transit EDRPOU), polling/sync intervals, integration status panel. Covers FR-SET-03 through FR-SET-07.

### Modified Capabilities

_(none)_

## Impact

- **DB:** new migration for `settings` table + seed data.
- **Schema:** new `lib/db/schema/settings.ts`.
- **Domain:** new `lib/settings/` with typed accessors.
- **UI:** 4 new pages under `app/(settings)/settings/`, sidebar nav extended.
- **Tests:** unit tests for settings accessors, regex pattern validation.
- **No new dependencies.**

## Context

S4 (tariffs) created the settings layout at `app/(settings)/settings/layout.tsx` with sidebar nav ("Тарифи", "Ціни СМС"). This slice extends it with classifier configuration pages. The classifier (S7) will read these settings at runtime. The `settings` table is a generic KV store — each key maps to a JSONB value.

Current stack: Drizzle ORM over Neon HTTP driver, Zod, server actions, shadcn/ui, existing settings layout.

## Goals / Non-Goals

**Goals:**

- `settings` table with `key TEXT PRIMARY KEY, value JSONB, updated_at`.
- Typed accessor layer in `lib/settings/` — `getSettingValue<T>(key)` / `setSettingValue(key, value)`.
- Seed: 5 regex patterns, SMS keywords, transit EDRPOU, polling intervals, sync schedule.
- `/settings/patterns` — CRUD with live regex test-area.
- `/settings/sms-keywords` — simple list editor.
- `/settings/transit-edrpou` — simple list editor.
- `/settings/integrations` — read-only status + editable intervals.
- Sidebar nav extended with new entries.

**Non-Goals:**

- Credentials display — FR-SET-07 says credentials are NOT shown, only connection status. Connection status requires actual API calls (S6/S9/S11). For now, show placeholder "Не налаштовано" statuses.
- Pattern overlap detection — patterns are applied in sequence, all matches are collected and deduped. No need to warn about overlapping patterns.
- Real-time validation of regex against actual payment data — the test-area is a client-side input where admin types a test string.

## Decisions

### D-S5-01: Generic KV table for settings

**Choice:** Single `settings` table with `key TEXT PRIMARY KEY, value JSONB` rather than separate tables per setting type.

**Why:** All settings are simple values (arrays, numbers, strings). A KV store is the simplest model and matches the PRD's description. Each setting has a well-known key name.

**Alternative:** Separate tables for patterns, keywords, etc. — rejected as over-engineering for ~10 keys.

### D-S5-02: Typed accessor layer

**Choice:** `lib/settings/index.ts` exports typed getters like `getContractPatterns(): Promise<PatternEntry[]>`, `getSmsKeywords(): Promise<string[]>`, etc. These read from the KV table and parse JSONB.

**Why:** Consumers (classifier, cron handlers) shouldn't know about the KV structure. Type-safe accessors prevent runtime errors.

### D-S5-03: Regex test-area is client-side only

**Choice:** The test-area on `/settings/patterns` runs the regex against a user-typed string entirely in the browser. No server action needed for testing.

**Why:** Regex execution is instant and deterministic. No benefit from server-side execution. Keeps the UX snappy.

### D-S5-04: List editors share a pattern

**Choice:** SMS keywords and transit EDRPOU pages use the same UI pattern: display items as tags/chips, "Add" input + button, "×" to remove. Each add/remove is a server action that reads the full array, modifies it, and writes back.

**Why:** Both are simple string arrays. A shared pattern reduces UI code.

### D-S5-05: Integration status is placeholder until S6/S9/S11

**Choice:** The integrations page shows 3 cards (ПриватБанк, Дубідок, Моє ОСББ) with editable intervals and a "Не налаштовано" status badge. Real status (from `integration_health` table) will be wired in when each integration slice is built.

**Why:** The page structure and interval editing are useful now. Status display requires actual API integration.

## Risks / Trade-offs

- **[Read-modify-write on arrays]** → Adding/removing items from a JSONB array requires reading the current value, modifying it in JS, and writing back. No concurrent admin users (single-admin system), so no race condition risk.
- **[Regex validation]** → A bad regex could crash the classifier. The UI validates that each pattern compiles, but doesn't prevent semantically wrong patterns. Acceptable — admin is the sole user.

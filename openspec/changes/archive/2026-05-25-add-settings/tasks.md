## 1. Database Schema & Migration

- [x] 1.1 Create `lib/db/schema/settings.ts` — Drizzle table `settings` with `key` (text PK), `value` (jsonb NOT NULL), `updated_at` (timestamp with timezone). Export types.
- [x] 1.2 Register in `lib/db/schema/index.ts` barrel export.
- [x] 1.3 Run `drizzle-kit generate` → rename to `0006_add_settings.sql`.
- [x] 1.4 Create seed migration `0007_seed_settings.sql` — INSERT 6 keys with ON CONFLICT DO NOTHING: `contract_regex_patterns` (5 starter patterns as JSON array of {pattern, description}), `sms_keywords` (["смс","sms","повідомлення"]), `transit_edrpou_list` (["14360570"]), `privatbank_polling_interval_minutes` (60), `dubidoc_poll_interval_hours` (6), `moeosbb_sync_schedule` ("first").
- [x] 1.5 Apply migrations via `drizzle-kit migrate`.

## 2. Domain — Settings Accessors

- [x] 2.1 Create `lib/settings/index.ts` with typed getters: `getContractPatterns(): Promise<{pattern: string; description: string}[]>`, `getSmsKeywords(): Promise<string[]>`, `getTransitEdrpouList(): Promise<string[]>`, `getPollingIntervals(): Promise<{privatbankMinutes: number; dubidocHours: number; moeosbbSchedule: string}>`.
- [x] 2.2 Add typed setter: `setSettingValue(key: string, value: unknown): Promise<void>` — upsert into settings table.

## 3. UI — Sidebar Nav Update

- [x] 3.1 Update `app/(settings)/settings/layout.tsx` sidebar nav to include: Тарифи, Ціни СМС, Патерни, Ключові слова СМС, Транзитні ЄДРПОУ, Інтеграції.

## 4. UI — Patterns Page

- [x] 4.1 Create `app/(settings)/settings/patterns/page.tsx` — server component that reads contract patterns and renders list + create form + test-area.
- [x] 4.2 Create pattern list component (display patterns with remove button) and create form (pattern input + description + validation that regex compiles).
- [x] 4.3 Create client-side test-area component — input for sample purpose string, displays which patterns match and captured groups.
- [x] 4.4 Create server actions: `addPattern`, `removePattern` in `actions.ts` — read-modify-write on `contract_regex_patterns` setting.

## 5. UI — SMS Keywords Page

- [x] 5.1 Create `app/(settings)/settings/sms-keywords/page.tsx` + list editor component + server actions (`addKeyword`, `removeKeyword`).

## 6. UI — Transit EDRPOU Page

- [x] 6.1 Create `app/(settings)/settings/transit-edrpou/page.tsx` + list editor component + server actions (`addEdrpou`, `removeEdrpou`). Validate 8-digit format.

## 7. UI — Integrations Page

- [x] 7.1 Create `app/(settings)/settings/integrations/page.tsx` — 3 integration cards (ПриватБанк, Дубідок, Моє ОСББ) with placeholder "Не налаштовано" status + editable interval fields.
- [x] 7.2 Create server actions for updating interval settings.

## 8. Tests

- [x] 8.1 Create `tests/unit/settings/accessors.test.ts` — test typed getters parse JSONB correctly (mock DB responses).
- [x] 8.2 Create `tests/unit/validation/settings.test.ts` — test regex compilation validation, EDRPOU 8-digit validation.

## 9. Quality & Finalization

- [x] 9.1 Run `npm run qa` — all 6 gates green.
- [x] 9.2 Manual smoke test: view patterns with seed data, add/remove pattern, test-area match, keywords CRUD, EDRPOU CRUD with validation, integrations intervals edit.

# Current State

**Останнє оновлення:** 2026-05-25
**Призначення:** snapshot фактичної готовності системи. Оновлюється у Definition-of-Done кожного capability slice ([`mvp-capability-plan.md § 6`](mvp-capability-plan.md)).

---

## Phase

`Phase 0 — MVP (in progress: S0 + S1 + S2 + S3 + S4 + S5 done)`

## Last completed slice

`S5. settings` — merged direct to `main`; change archived до `openspec/changes/archive/2026-05-25-add-settings/`; spec живе у `openspec/specs/settings/spec.md`.

## Next slice

`S6. payments-ingest` (див. [`mvp-capability-plan.md § 5`](mvp-capability-plan.md)). Перед стартом — `/opsx:propose add-payments-ingest`.

## Blockers

Жодних поточних блокерів. Відкриті TBD-питання, які прояснюються до відкриття відповідного зрізу — у [`mvp-capability-plan.md § 7`](mvp-capability-plan.md):

- `TBD-S6-1` — sandbox для PrivatBank API (стане блокером перед S6).
- `TBD-S8-1` — Chromium cold-start на Vercel Function (стане блокером перед S8).
- `TBD-S9-1` — sandbox-токен Дубідок Premium (стане блокером перед S9).
- `TBD-S11-1` — мережевий доступ з Vercel у приватний MySQL "Моє ОСББ" (стане блокером перед S11).

## Capability completion matrix

| ID  | Slice                | Status      | PR  | Demo recording                     |
| --- | -------------------- | ----------- | --- | ---------------------------------- |
| S0  | Phase 0 setup        | done        | —   | n/a (no UI)                        |
| S1  | auth                 | done        | —   | skipped (dev smoke logs in commit) |
| S2  | clients              | done        | —   | skipped                            |
| S3  | contracts            | done        | —   | skipped                            |
| S4  | tariffs              | done        | —   | skipped                            |
| S5  | settings             | done        | —   | skipped                            |
| S6  | payments-ingest      | not started | —   | —                                  |
| S7  | classification       | not started | —   | —                                  |
| S8  | acts                 | not started | —   | —                                  |
| S9  | edo-dubidoc          | not started | —   | —                                  |
| S10 | edo-vchasno-external | not started | —   | —                                  |
| S11 | moeosbb-sync         | not started | —   | —                                  |
| S12 | queue (polish)       | not started | —   | —                                  |
| S13 | dashboard (polish)   | not started | —   | —                                  |

Статуси: `not started` / `in progress` / `done` / `blocked`.

## Recent activity

- `2026-05-25` — **S5 (settings) complete.** `lib/db/schema/settings.ts` (KV-таблиця `settings` з `key TEXT PK`, `value JSONB`); міграції `0006_add_settings.sql` + `0007_seed_settings.sql` (5 regex-патернів, sms_keywords, transit_edrpou_list, 3 інтервали). `lib/settings/index.ts` — typed getters (`getContractPatterns`, `getSmsKeywords`, `getTransitEdrpouList`, `getPollingIntervals`) + `setSettingValue` upsert. UI: `/settings/patterns` (CRUD + live test-area з match highlight + captured groups), `/settings/sms-keywords` (chip-editor), `/settings/transit-edrpou` (chip-editor з 8-digit validation), `/settings/integrations` (3 placeholder status cards + editable intervals form). Sidebar nav розширено до 6 entries. 113/113 unit-тестів (13 нових: 5 accessors + 8 validation). `npm run qa` — 6/6 green. PRD coverage: FR-SET-03..07. Spec archived до `openspec/specs/settings/spec.md`.
- `2026-05-25` — **S4 (tariffs) complete.** `lib/db/schema/tariffs.ts` (таблиці `tariffs` з UNIQUE (apartments_min, apartments_max, effective_from) і `sms_prices` з UNIQUE effective_from); міграції `0004_add_tariffs.sql` + `0005_seed_tariffs.sql` (catch-all 200 грн, SMS 1.40 грн). `lib/tariffs/resolve.ts` — `resolveAccessPrice` (override → ranged narrowest → catch-all, versioned by effective_from) + `resolveSmsPrice`. `lib/validation/tariffs.ts` — Zod-схеми `createTariffSchema` / `createSmsPriceSchema`. Server actions: `createTariff` / `deleteTariff` (з catch-all invariant) у `app/(settings)/settings/tariffs/`, `createSmsPrice` / `deleteSmsPrice` у `app/(settings)/settings/sms-prices/`. UI: `/settings/tariffs` (таблиця + create form), `/settings/sms-prices` (таблиця + create form), settings layout з sidebar nav. Shared `TopBar` component з "Налаштування" link. 100/100 unit-тестів (27 нових: 15 resolver + 12 validation). `npm run qa` — 6/6 green. PRD coverage: FR-TAR-01..10, FR-SET-01..02. Spec archived до `openspec/specs/tariffs/spec.md`.
- `2026-05-25` — **S3 (contracts) complete.** `lib/db/schema/contracts.ts` (таблиця `contracts` з 9 полями, UNIQUE на `client_id`, FK RESTRICT до `clients`); міграція `0003_add_contracts.sql` applied. `lib/validation/contracts.ts` — Zod-схеми `createContractSchema` / `updateContractSchema` з `signedDate` (date), `number` (non-empty), `fileUrl` (URL). Server actions: `createContract` / `updateContract` / `deleteContract` у `app/(dashboard)/clients/[id]/contract-actions.ts` з cardinality check і FK violation handling. UI: contract form embedded у "Договір" tab клієнтської картки (`contract-form.tsx`) — create mode з pre-fill `number` від `moeosbb_user_id`, edit mode з FR-CTR-04 warning, delete з confirmation. `ContractWarning` тепер conditional — показується тільки коли клієнт не має договору. `ClientField` розширено типом `date`. 73/73 unit-тестів (16 нових для contract validation). `npm run qa` — 6/6 green. PRD coverage: FR-CTR-01..06, FR-CLI-11 (conditional). Spec archived до `openspec/specs/contracts/spec.md`, `clients` spec оновлено.
- `2026-05-25` — **S2 (clients) complete.** `lib/db/schema/clients.ts` (таблиця `clients` з 15 полями, `pgEnum('edo_provider')`, 2 індекси); міграція `0002_add_clients.sql` applied. `lib/validation/clients.ts` — Zod-схеми `createClientSchema` / `updateClientSchema` з `legal_id` (8/10 digits), email, `apartments_count ≥ 1`, `access_price_override` decimal format. Server actions: `createClient` / `updateClient` / `archiveClientAction` / `activateClientAction` у `app/(dashboard)/clients/actions.ts`. UI: `/clients` (список з пошуком + фільтри Active/Archive, Local/MoeOSBB, edo_provider через URL params), `/clients/new` (create form з prefill query params, FR-CLI-02), `/clients/[id]` (card з tabs: info form, 3 stubs для S3/S6/S8, contract warning FR-CLI-11). Navigation link "Клієнти" у top-bar. 57/57 unit-тестів (19 нових для validation schemas). `npm run qa` — 6/6 green. PRD coverage: FR-CLI-01..11, BC-DATA-03, BC-USER-03. Spec archived до `openspec/specs/clients/spec.md`.
- `2026-05-24` — **S1 (auth) code complete on `add-auth` branch.** `lib/auth/` (password / session / rate-limit / cookie / safe-next), `lib/db/schema/auth.ts` (`sessions`, `login_attempts` з індексами), міграція `0001_add_auth.sql` applied на Neon dev branch. `proxy.ts` гейтує всі шляхи (whitelist: `/login`, `/api/health`, `_next/static|image|data`, `favicon.ico`); Q-S1-1 резолвлено — Next 16 `NextRequest` НЕ експонує `request.ip`, парсимо `x-forwarded-for` у `signIn` action. `app/(auth)/login` + `app/(dashboard)/` (top-bar з admin email + `signOut`). Server actions: `signIn` (Zod → rate-limit → argon2id verify → createSession → cookie set → safe redirect), `signOut`. 38/38 unit-тестів проходять (`tests/unit/auth/*`). `npm run qa` — 6/6 gates green (lint / format:check / typecheck / test:run / build / openspec validate). Human-gated кроки залишилися: `vercel env add ADMIN_EMAIL / ADMIN_PASSWORD_HASH / SESSION_SECRET` (per env), `npm run dev` smoke recording (Chrome DevTools MCP) у `docs/qa/recordings/S01-auth.md`, `openspec archive add-auth`. Скрипт `scripts/hash-password.mjs` генерує argon2id хеш зі stdin/TTY-prompt.
- `2026-05-24` — **S0 (Phase 0 setup) complete.** Drizzle + Neon HTTP driver + `lib/db/` (singleton `db`, `schema/observability.integration_health`, перша SQL міграція `0000_init_integration_health.sql`). `lib/logging/` (pino з redact по всіх secrets з NFR-SEC-02). `lib/observability/` (`recordIntegrationSuccess` / `recordIntegrationError` / `getIntegrationHealth`). `lib/{auth,blob,pdf,external-apis,i18n}/` — README-only shape, готові до slot-in. `proxy.ts` (Next 16, pass-through stub з matcher, що виключає static + `/api/health`). `vercel.ts` (через `@vercel/config/v1`, `crons: []`). `app/api/health/route.ts` → `{ status: 'ok' }`. `app/page.tsx` + `app/layout.tsx` — мінімальний UA placeholder (Geist sans, метаданi). Import-boundary правила в `.oxlintrc.json` (`lib/` ↛ `next/*`; `app/` ↛ `app/api/internals/`). `db:generate` / `db:migrate` / `db:studio` scripts. `npm run qa` — 6/6 gates pass (lint / format / typecheck / test / build / openspec validate).
- `2026-05-22` — Severity 1+2 закриття перед S0: pin Node 22 (`.nvmrc` + `engines`), `.env.example` зі всіма ENV з NFR-SEC-02, hardening хуків (jq hard-dep check), `.editorconfig`, `.oxlintrc.json` (correctness+suspicious+perf як error, pedantic як warn, плагіни react/jsx-a11y/nextjs/import/promise), strict TS прапори (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`), jsdom→happy-dom + `@vitest/coverage-v8` з 70% threshold на lib/+components/, RBP regex приймає screenshot OR verification log, `AGENTS.md` оновлено: first-time setup для людини (`vercel link` / `env pull`) + Quality gates + Тести.
- `2026-05-22` — Прийнято [D-038](adr/D-038-drizzle-orm.md) (Drizzle ORM, відкладена інсталяція до S0) і [D-039](adr/D-039-test-http-mocks.md) (MSW як єдина стратегія HTTP-моків, відкладена інсталяція до S6). `tests/mocks/README.md` фіксує convention.
- `2026-05-22` — Quality gates stack: oxlint (eslint видалено), Prettier, Vitest, `scripts/qa-verify.mjs`, Claude Code hooks (PostToolUse/Stop/PreToolUse), `.github/workflows/ai-pr-check.yml` (static-gates + real-behavior-proof), PR template, `docs/qa/traceability-matrix.md`. Зафіксовано в [D-037](adr/D-037-quality-gates-stack.md) (переглядає [D-035](adr/D-035-cicd.md) в частині tooling).
- `2026-05-22` — Створено `docs/mvp-capability-plan.md`, `docs/current-state.md`, `docs/qa/recordings/`.
- `2026-05-22` — Перенесено ADR і референс-документацію з `fop-docs/research/` у `docs/`.
- `2026-05-21` — Створено `docs/prd.md` (структурована форма FR/NFR/TC/BC).

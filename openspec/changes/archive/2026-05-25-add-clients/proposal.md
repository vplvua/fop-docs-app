## Why

Без клієнтської картотеки ні один наступний slice (contracts S3, tariffs S4, payments S6, classification S7, acts S8) не може функціонувати — `Client` є FK-кореневою сутністю для всіх бізнес-об'єктів. Адмін потребує UI для ручного ведення клієнтів (ОСББ, ЖБК, ТОВ, ФОП-управителі), включаючи кілька manual-only полів (`apartments_count`, `access_price_override`, `auto_act_disabled`, `edo_provider`), які не синхронізуються з "Моє ОСББ".

## What Changes

- **Таблиця `clients`** у Postgres з Drizzle-схемою: uuid PK, синхронізовані поля (`name`, `legal_id`, `address`, `bank_name`, `bank_account`, `email`), manual-only поля (`apartments_count`, `access_price_override`, `auto_act_disabled`, `edo_provider`), nullable `moeosbb_user_id` (UNIQUE), `last_sync_at`, `created_at`, `updated_at`.
- **Postgres ENUM `edo_provider`** (`dubidoc`, `vchasno_external`) — використовується в `clients` і пізніше в `acts`.
- **Сторінка `/clients`** — список клієнтів із пошуком за `name`/`legal_id` та фільтрами: Active/Archive (`auto_act_disabled`), Локальні/MoeOSBB (`moeosbb_user_id`), `edo_provider`.
- **Сторінка `/clients/new`** — форма створення клієнта. Якщо перехід із картки платежу — `name`, `legal_id`, `bank_account` передзаповнені з query params (FR-CLI-02; UI-заглушка поки S6 не існує).
- **Сторінка `/clients/[id]`** — картка клієнта з tabs: "Загальна інформація" (форма редагування), "Договір"/"Платежі"/"Акти" як stubs (наповнюються у S3/S6/S8). Warning без договору (FR-CLI-11; визначається відсутністю contract, що стає реальним у S3 — поки завжди показується).
- **Server actions:** `createClient`, `updateClient`, `archiveClient` (soft-archive: set `auto_act_disabled=true`), `linkToMoeosbb` (set `moeosbb_user_id`, unique validation).
- **Validation (Zod):** `legal_id` — рівно 8 або 10 цифр; `email` — RFC-формат; `moeosbb_user_id` — uniqueness check; `apartments_count` ≥ 1 if present; `access_price_override` ≥ 0 if present.
- **FK constraints** (`ON DELETE RESTRICT`) для `Contract.client_id`, `Payment.client_id`, `Act.client_id` — заглушки в коментарях; фактичні FK з'являються у S3/S6/S8.
- **Tests:** unit (Zod schemas, legal_id validation), smoke (CRUD round-trip on real Neon dev branch), E2E placeholder (Chrome DevTools MCP або Playwright setup для S2+).

## Capabilities

### New Capabilities

- `clients`: admin manages a client directory — CRUD, archive, filter/search, linking to MoeOSBB, validation rules (legal_id format, email, uniqueness).

### Modified Capabilities

(none — `auth` requirements do not change; client routes are already gated by the existing session check in `proxy.ts`.)

## Impact

- **Code (нове):**
  - `lib/db/schema/clients.ts` — Drizzle table `clients` + enum `edoProviderEnum`.
  - `lib/db/migrations/0002_add_clients.sql` (Drizzle generate).
  - `app/(clients)/clients/page.tsx`, `app/(clients)/clients/new/page.tsx`, `app/(clients)/clients/[id]/page.tsx`, shared components.
  - `app/(clients)/actions.ts` — server actions.
  - `lib/validation/clients.ts` — Zod schemas for create/update.
- **Code (зміни):**
  - `lib/db/schema/index.ts` — re-export `clients`.
  - `app/(dashboard)/layout.tsx` — додати навігацію "Клієнти" у top-bar (або sidebar, якщо з'явиться).
- **Залежності (нові npm):** жодних — Zod, Drizzle, React, shadcn вже є.
- **Env:** жодних нових змінних.
- **БД:** 1 нова таблиця, 1 новий enum, 1 міграція.
- **PRD coverage:** **FR-CLI-01..11**, **BC-DATA-03**, **BC-USER-03**.
- **Demo:** створення клієнта з нуля; редагування manual-only полів; архівування; фільтри Active/Archive.

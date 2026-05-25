## Context

S1 (auth) завершений: `proxy.ts` гейтує всі маршрути, `lib/auth/` надає session-перевірку. Drizzle ORM + Neon HTTP driver працюють (таблиці `sessions`, `login_attempts`, `integration_health`). Тести — 38/38 unit.

S2 вводить першу бізнес-сутність `Client`. Наступні slices (S3 contracts, S4 tariffs, S6 payments, S7 classification, S8 acts) залежать від неї через FK. `Client` має дуальну природу: частина полів синхронізується з "Моє ОСББ" MySQL (S11), частина — manual-only. У S2 sync ще не існує — всі поля вводяться руками, але schema закладає розмежування (поле `last_sync_at`, `moeosbb_user_id`).

**Constraints (з AGENTS.md / project.md):**

- `lib/` без `next/*` imports; server actions у `app/`.
- Neon HTTP driver — без `db.transaction()`. Для S2 транзакції не потрібні (CRUD на одній таблиці).
- `exactOptionalPropertyTypes: true` у tsconfig — `prop?: T | undefined` explicitly.
- `max-lines-per-function = 50` (oxlint) — виносимо helpers.

## Goals / Non-Goals

**Goals:**

- Адмін може створити, відредагувати, (soft-)архівувати клієнта.
- Список клієнтів з пошуком (`name`, `legal_id`) і фільтрами (Active/Archive, Local/MoeOSBB, `edo_provider`).
- Картка клієнта з tabs (info + 3 stubs: Договір/Платежі/Акти).
- Warning "Без договору акти не генеруються" (FR-CLI-11) — відображається завжди у S2 (реальна перевірка з'явиться у S3).
- `legal_id` validation: рівно 8 або 10 цифр.
- `moeosbb_user_id` uniqueness validation (server-side).
- Навігація у dashboard top-bar ("Клієнти" link).

**Non-Goals:**

- Sync з "Моє ОСББ" (S11).
- Prefill з картки платежу (S6; query params mechanism готуємо, але без реальних джерел).
- Bulk-операції (Phase 1).
- Повноцінні tabs Договір/Платежі/Акти (S3/S6/S8 — поки порожні stubs).
- Пошук по `moeosbb_user_id` (low-volume, enough to search by name/legal_id).

## Decisions

### D-S2-01: UUID v7 як PK для `clients`

**Вибір:** `uuid` з генерацією через `crypto.randomUUID()` (UUID v4 у Node 22; Drizzle `uuid().defaultRandom()`).

**Чому:**

- Узгодженість з PRD domain-model (`id: uuid`).
- Безпечні для URL (no sequence guessing).
- Drizzle `uuid().defaultRandom()` генерує на стороні клієнта, не потребує DB sequence.
- Для 300 клієнтів (PRD target) performance різниці між UUID і bigserial немає.

**Альтернативи:** bigserial — простіше, але вже прийнято convention UUID у PRD.

### D-S2-02: Postgres ENUM `edo_provider` через Drizzle `pgEnum`

**Вибір:** `pgEnum('edo_provider', ['dubidoc', 'vchasno_external'])`.

**Чому:**

- DB-рівнева гарантія валідних значень.
- Enum переиспользується в `acts` table (S8) для `Act.edo_provider`.
- Drizzle `pgEnum` генерує `CREATE TYPE ... AS ENUM(...)` у міграції.

**Ризик:** Додавання нового значення enum у Postgres вимагає `ALTER TYPE ... ADD VALUE` (не reversible without tricks). Для MVP з двома значеннями це прийнятно.

### D-S2-03: `auto_act_disabled` як soft-archive (BC-DATA-03)

**Вибір:** архівування = `UPDATE clients SET auto_act_disabled = true WHERE id = $1`. Немає окремого `archived_at` або `deleted` поля.

**Чому:**

- PRD (FR-CLI-08, BC-DATA-03): "Кнопка 'Архівувати' встановлює `auto_act_disabled = true`". Подвійне призначення поля (блокує авто-акти + UI ознака архіву).
- FK `RESTRICT` унеможливлює DELETE — soft-archive єдиний шлях.

**Ризик:** семантика "архів" і "відключити авто-акти" зливаються. PRD це explicitly стверджує — тому дотримуємося.

### D-S2-04: Server actions, не REST routes

**Вибір:** `createClient`, `updateClient`, `archiveClient`, `linkToMoeosbb` як `"use server"` функції в `app/(clients)/actions.ts`. Без REST endpoints.

**Чому:**

- Узгодженість з S1 pattern (signIn/signOut — server actions).
- Зменшення поверхні API (NFR-SEC-07: мінімум webhook/REST endpoints).
- `revalidatePath` / `redirect` — нативно в server actions.

### D-S2-05: Validation у `lib/validation/clients.ts` (Zod)

**Вибір:** Zod-схеми `createClientSchema`, `updateClientSchema` у `lib/validation/`. Server actions (в `app/`) імпортують і `.safeParse()`.

**Чому:**

- `lib/` boundary — Zod-схеми чисті (без `next/*`), тестуються unit-тестами.
- Re-use: і server action, і потенційний API route можуть валідувати.
- `drizzle-zod` (`createInsertSchema`) не використовуємо — explicit schemas більш читабельні і дозволяють різні constraints для create vs update.

### D-S2-06: Навігація через top-bar links, не sidebar

**Вибір:** додаємо horizontal links у існуючий `app/(dashboard)/layout.tsx` top-bar header: "Клієнти" (з S2), пізніше "Тарифи", "Налаштування", "Черга" (S3-S12).

**Чому:**

- MVP має 3-5 top-level routes — sidebar надлишковий; horizontal nav достатньо.
- DESIGN.md не специфікує sidebar pattern; shadcn `NavigationMenu` або plain links працюють.
- Переробка на sidebar можлива у S12-S13 polish-slices якщо потрібно.

### D-S2-07: Shared layout для client pages

**Вибір:** `app/(clients)/clients/layout.tsx` не потрібен окремо — клієнтські сторінки вкладені у `(dashboard)` layout через route group nesting.

**Структура:**

```
app/
  (dashboard)/
    layout.tsx              ← top-bar (shared for all dashboard pages)
    page.tsx                ← dashboard home
    clients/
      page.tsx              ← list
      new/page.tsx          ← create form
      [id]/page.tsx         ← card with tabs
    actions.ts              ← server actions
```

**Чому:** route group `(clients)` зайвий — `clients/` живе під `(dashboard)/` і отримує shared layout автоматично. Менше nesting, простіше.

### D-S2-08: `numeric(10,2)` для `access_price_override`

**Вибір:** Drizzle `numeric("access_price_override", { precision: 10, scale: 2 })`. Зберігається як string у JS (Drizzle behaviour для `numeric`).

**Чому:**

- Точне десяткове значення без floating-point drift (ціни в гривнях з копійками).
- `numeric(10,2)` покриває range до 99,999,999.99 — більш ніж достатньо.
- Zod schema використовує `z.string().regex(/^\d+(\.\d{1,2})?$/)` для input, перетворює display → format у UI.

## Risks / Trade-offs

| #   | Risk                                                                                            | Mitigation                                                                                                                                                            |
| --- | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **`moeosbb_user_id` uniqueness race** — два concurrent inserts з тим самим ID.                  | UNIQUE constraint на DB level. Neon HTTP driver не має transactions, але UNIQUE index = DB-enforced; Drizzle кине error, server action ловить і повертає field error. |
| 2   | **Enum extension** — додавання третього `edo_provider` пізніше потребує `ALTER TYPE ADD VALUE`. | Прийнятно для MVP. Якщо потрібно більше — міграція одним ALTER.                                                                                                       |
| 3   | **300 клієнтів у списку без серверної пагінації** — один RSC fetch усіх рядків.                 | Для 300 рядків з lightweight SELECT — < 50ms on Neon. Пагінація додається у Phase 1 якщо list зросте.                                                                 |
| 4   | **Top-bar horizontal nav стане тісним** при 6+ links (S2-S13).                                  | Переробка на sidebar/dropdown у S12-S13 polish; для MVP 2-3 links це ОК.                                                                                              |
| 5   | **Stale client data в UI після concurrent edit** (admin у двох tabs).                           | Single-admin system (BC-USER-01) — race практично неможливий. `revalidatePath` після кожного mutation достатньо.                                                      |

## Open Questions

| ID     | Питання                                                          | Хто   | Коли                                                |
| ------ | ---------------------------------------------------------------- | ----- | --------------------------------------------------- |
| Q-S2-1 | Чи потрібна пагінація у `/clients` вже зараз (300 клієнтів max)? | автор | Day 1 — вирішено у design: ні, без пагінації в MVP. |

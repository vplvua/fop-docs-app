# D-038 — Drizzle ORM як шар доступу до Postgres

**Дата:** 2026-05-22

**Уточнює:** [D-024](D-024-postgres.md) (Postgres як локальна БД) — вибирає конкретний ORM/builder поверх цього рішення.

**Рішення:**

1. **Drizzle ORM** + `drizzle-kit` (міграційний раннер) — єдиний шар доступу до Postgres у проекті.
2. **Schema-first:** усі таблиці описуються в `lib/db/schema/*.ts` через TypeScript-DSL Drizzle. Це single source of truth для рядка БД і для TS-типів.
3. **Driver:** `@neondatabase/serverless` для serverless-середовища Vercel Functions (узгоджено з [D-034](D-034-vercel-hosting.md) hosting).
4. **Migrations:** `drizzle-kit generate` створює SQL-міграції у `lib/db/migrations/`, `drizzle-kit migrate` (або `drizzle-orm/migrator` у runtime) застосовує. Усі міграції — checked-in SQL-файли, без runtime-only migrations.
5. **Розташування:**
   - `lib/db/schema/<domain>.ts` — Drizzle table definitions per capability (`clients.ts`, `contracts.ts`, ...).
   - `lib/db/schema/index.ts` — re-export всіх таблиць.
   - `lib/db/index.ts` — singleton `db` client (`drizzle(neon(POSTGRES_URL))`).
   - `lib/db/migrations/` — SQL міграції.
   - `drizzle.config.ts` — конфіг для `drizzle-kit`.
6. **Інсталяція відкладається** до Phase 0 setup (S0) — перший capability, який потребує БД (S1 auth). Drizzle деп не додаємо в `package.json` зараз, щоб не вводити dead deps.

**Альтернативи:**

- **Prisma.** Відкинуто. Зрілий і з великою екосистемою, але:
  - Важчий runtime (Prisma Engine — окремий бінарник), повільніший cold-start на Vercel Fluid Compute.
  - Власна schema language (`schema.prisma`) — додатковий синтаксис поза TS; AI-агенту складніше тримати контракт між Prisma schema і TS-кодом синхронним без runtime-introspection.
  - Дебагінг N+1 і складних joins — менш прозорий, ніж у Drizzle, який ближче до SQL.
  - Prisma Accelerate / Pulse (для serverless oversubscribe) — коштує грошей, ціна $0 не вписується.
- **Kysely.** Відкинуто. Найшвидший type-safe query builder, але:
  - Schema і типи треба тримати окремо (через `kysely-codegen` від реальної БД), що ламає AI-friendly schema-first підхід.
  - Міграційного раннера з коробки нема — додатково `node-pg-migrate` або власний — більше рухомих частин.
- **Raw `pg` / `postgres-js` без ORM.** Відкинуто. Втрачаємо type-safety; FK-перевірки і `ON DELETE RESTRICT` (NFR-SEC-08) лишаються в БД, але код звертається до них «строкою», що AI-агент часто ламає.
- **TypeORM, MikroORM, Sequelize.** Відкинуто без розгорнутого обґрунтування — менш активна підтримка / decorator-based / нативно не TS-first.

**Обґрунтування:**

- **Schema-first TS-DSL** — AI-агент бачить таблиці як TS-код у repo, без runtime-introspection. Зміни схеми = diff у `lib/db/schema/*.ts` = type-checked поширення по всьому коду.
- **Близько до SQL.** Drizzle queries виглядають як SQL у TS — `db.select().from(clients).where(eq(clients.id, ...))`. Менша магія, простіше дебажити, простіше переписати на raw SQL у крайньому випадку.
- **Neon serverless driver** — HTTP-fetch транспорт замість TCP-pool, оптимально під Fluid Compute (короткі instance-и, шерять виклики, але без stateful connection pool overhead). Drizzle підтримує його з коробки.
- **Маленький runtime footprint** (~10-30KB gzipped) — мінімальний impact на cold-start NFR-PERF-02/03.
- **Транзакції** через `db.transaction(async (tx) => {...})` — потрібні для `Payment.status` state-machine і act creation (BC-LEGAL-05 immutability).
- **Сумісно з branded Zod-types** зі слайду 9 — Drizzle column-типи можна `$type<CustomerId>()` brand-ити, single source of truth runtime + compile.

**Наслідки:**

- У Phase 0 setup (S0, перед S1) додаються deps: `drizzle-orm`, `@neondatabase/serverless`, `drizzle-kit` (dev), `drizzle-zod` (опційно — для генерації Zod-схем зі схеми Drizzle).
- Створюється `drizzle.config.ts`, `lib/db/index.ts`, `lib/db/schema/index.ts`, `lib/db/migrations/`.
- `npm run db:generate` (`drizzle-kit generate`), `npm run db:migrate` (`drizzle-kit migrate`), `npm run db:studio` (`drizzle-kit studio`) — додаються в `package.json scripts`.
- Integration smoke-тести (з S2+) бігають на Neon branch — не на mock, не на SQLite. Узгоджено з verification pyramid (слайд 1).
- В `tests/integration/<capability>/*.smoke.ts` використовується real `db` instance з тестового middleware (truncate-and-seed per test). MSW (D-039) DB не перехоплює — це окремий шар.
- `lib/db/` не імпортує нічого з `app/` (правило з AGENTS.md "lib/ MUST be pure").
- В CI може знадобитись окремий job для `db:migrate --dry-run` як санітарна перевірка міграцій (TBD — додаємо коли з'явиться перша міграція).

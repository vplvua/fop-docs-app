## Context

Phase 0 завершено: Drizzle + Neon HTTP driver, pino-логер з redact-правилами, `integration_health`, `proxy.ts` як pass-through stub з matcher, що виключає статику і `/api/health` (див. [`docs/current-state.md`](../../../docs/current-state.md) і [S0 deliverables](../../../docs/mvp-capability-plan.md#4-phase-0-setup-slice-0--bootstrap)). `lib/auth/` існує як README-only shell.

Цей slice реалізує єдиний admin-login flow (`BC-USER-01`, `FR-AUTH-01..06`) і вмикає реальний gating через `proxy.ts`, що відкриває шлях до всіх наступних slices (S2 — S13). Single-tenant, без UI для self-service registration або recovery — креди лежать в env, ротуються через `vercel env`.

**Stakeholders:** автор-власник ФОП (єдиний користувач), оператор CI (gates у [§ 6 Definition of Done](../../../docs/mvp-capability-plan.md#6-definition-of-done--per-slice-чек-лист)).

**Constraints:**

- Next.js 16 (`proxy.ts`, не `middleware.ts`; APIs можуть відрізнятися від training data — читати `node_modules/next/dist/docs/`).
- `lib/db/` зараз — Neon **HTTP** driver, без `db.transaction()`. У S1 транзакція не критична (`sessions` write — одна row), але швидке зростання `login_attempts` варто слідкувати.
- `lib/` MUST NOT import `next/*` ([AGENTS.md import boundaries](../../../AGENTS.md#architecture-hard-import-boundaries)). Cookie-set / redirect — це робота `proxy.ts` / server actions; `lib/auth/` повертає чисті результати.
- Vercel Functions = Node 22 runtime; native bindings можна (Fluid Compute). Edge функцій не використовуємо.
- Static gates: lint / typecheck / vitest / build / openspec validate (`npm run qa`) мають лишатись зеленими.

## Goals / Non-Goals

**Goals:**

- Адмін може залогінитись і вийти, отримати persistent session (30 днів), бути redirect-нутим назад на `next`-параметр.
- Неавтентифікований запит на будь-яку non-whitelist URL → 307 redirect на `/login?next=<original>`; whitelist: `/login`, `/api/health`, статика (`_next/*`, `favicon.ico`).
- 10 невдалих спроб з одного IP за 60 хвилин → 429 з месиджем "Спробуйте через ~Xхв"; лічильник скидається після успіху + після закінчення вікна.
- `lib/auth/` лишається pure (без `next/*` import-ів).
- Жодного секрету в логах (use `lib/logging/` з існуючими redact-правилами).
- Demo recording відтворюється за 90 секунд.

**Non-Goals:**

- 2FA, recovery flow, self-service registration, multi-admin, OAuth/Google login (поза MVP — `BC-SCOPE-10`, `BC-USER-01`).
- Cleanup expired sessions / `login_attempts` (cron — окремий backlog Phase 1; у MVP допустиме growth ~ десятки рядків / місяць).
- Email-уведомлення про підозрілі логіни (poза MVP — `BC-SCOPE-09`).
- CSRF tokens у формі (SameSite=Lax + server actions same-origin — достатньо для single-admin MVP; deeper analysis у Risks).
- Replay/revocation окремої сесії з UI (rotate можна через `vercel env update SESSION_SECRET` — інвалідує всі сесії).

## Decisions

### D-S1-01: argon2id verify через `@node-rs/argon2`, не `argon2`

**Вибір:** `@node-rs/argon2` (Rust binding via napi-rs).

**Чому:**

- Native бінарка не потребує `node-gyp` build step; Vercel Fluid Compute (Node 22) supports prebuilt napi.
- Менший cold-start vs `argon2` (С++ binding потребує build under deployment).
- API: `await verify(hash, password)` — boolean.
- Тільки `verify` потрібно: `ADMIN_PASSWORD_HASH` генерується одноразово локально (`pnpm dlx @node-rs/argon2 hash <pw>` або скрипт у `scripts/hash-password.mjs` — додамо в tasks).

**Альтернативи:**

- `argon2` (Node.js wrapper для C++ argon2): працює, але важчий postinstall, потребує `python` + build tools у CI.
- `@noble/hashes` argon2: pure-JS, ~ 10× повільніше; для MVP з рідкісним логіном прийнятно, але cold-path-у login краще тримати ~50ms, а не ~500ms.
- WebCrypto PBKDF2: не argon2id, не відповідає `NFR-SEC-03`.

### D-S1-02: Session = opaque random token (32 bytes), HMAC у БД

**Структура:**

- Cookie: `__Host-session=<base64url-token>`; `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, `Max-Age=2592000` (30 днів).
- БД-таблиця `sessions(token_hash TEXT PRIMARY KEY, expires_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), ip INET)`.
- `token_hash = base64url(hmacSha256(SESSION_SECRET, raw_token))`.

**Чому HMAC, а не plain hash (`sha256(token)`)?**

- HMAC прив'язаний до `SESSION_SECRET`. Витік таблиці `sessions` без SECRET = неможливо створити валідний cookie. Plain `sha256` дозволив би brute-force на короткі токени (хоча 32 байти і так робить це невиправданим — HMAC == "defense in depth").
- Дешевше і простіше за JWT: revocation = `DELETE FROM sessions WHERE token_hash = $1`; немає complexity з public/private keys.

**Альтернативи:**

- JWT signed з `SESSION_SECRET`: revocation потребує denylist → ускладнення без вигоди для single-admin.
- `iron-session` / `next-auth`: занадто importable, тягне next.js залежності в `lib/`, що ламає import boundary.

### D-S1-03: Cookie name `__Host-session`

**Чому prefix `__Host-`:**

- Browser-enforced rules: cookie з префіксом `__Host-` мусить мати `Secure`, `Path=/`, без `Domain`. Це блокує subdomain hijack і випадкове виставлення на http.
- У dev на `http://localhost` `Secure` cookies також працюють для localhost (Chrome/Firefox exception).

### D-S1-04: Rate-limit — IP-based, persisted у БД, sliding window

**Реалізація:**

- Таблиця `login_attempts(id BIGSERIAL PRIMARY KEY, ip INET NOT NULL, attempted_at TIMESTAMPTZ NOT NULL DEFAULT now(), success BOOLEAN NOT NULL)`.
- Перед `verify` логіки: `SELECT count(*) FROM login_attempts WHERE ip = $1 AND success = false AND attempted_at > now() - interval '60 minutes'`. Якщо ≥ 10 — повернути `RateLimitedError` з `retryAfterSec`.
- Після `verify`:
  - success → INSERT row `success=true`; додатково `DELETE FROM login_attempts WHERE ip = $1 AND success = false` (скидає вікно).
  - failure → INSERT row `success=false`.

**Чому БД, а не in-memory / Redis:**

- Fluid Compute reuses instances, але не гарантує coherent state між регіонами / cold-starts. In-memory лічильник — easy bypass.
- Vercel KV / Redis = ще одна залежність; у нас вже є Postgres. Розмір таблиці: 10 спроб × 24 години × 365 ≈ ~ 90K rows у worst case (єдиний admin, переважно зловмисні bot-и). Це нічого для Postgres; CRON cleanup — Phase 1 backlog.

**Альтернативи:**

- `upstash/ratelimit` + Vercel KV: працює, але KV — sunset (див. injected reminder); Marketplace Redis/Upstash потрібен окремо.
- Token-bucket у пам'яті per-instance: непридатний для Fluid Compute зі скейлом > 1 instance.

### D-S1-05: IP source = `x-forwarded-for` first hop, fallback `x-real-ip`

**Чому:**

- Vercel завжди ставить `x-forwarded-for` з реальним IP клієнта у першому елементі (документовано). `x-real-ip` — як fallback для локальних/test scenarios.
- `proxy.ts` має `request.ip` у Next 16? — TBD на старті імплементації; перевірити по `node_modules/next/dist/docs/` (відкритий-Q1 нижче).

### D-S1-06: `proxy.ts` — тільки gating, бізнес-логіка в server actions

**Розподіл:**

- `proxy.ts`: для кожного request читає cookie → викликає `lib/auth/validateSession(tokenHash)` → якщо null/expired → 307 redirect на `/login?next=<encoded original>`; інакше пускає далі. Для `/login` з валідною сесією — redirect на `/`.
- `signIn` / `signOut` — server actions у `app/(auth)/actions.ts`: верифікують, ставлять/видаляють cookie через `cookies()` з `next/headers`, повертають `redirect()`.
- `lib/auth/` — чисті функції: `verifyPassword`, `createSession`, `validateSession`, `destroySession`, `checkRateLimit`, `recordAttempt`. Усі приймають `db` instance і `now: () => Date` для test-injection.

**Чому розподіл:**

- Дотримання `AGENTS.md` boundary: `lib/` без `next/*`.
- Простіше тестувати: всі invariants — unit-тестовані без Next.js runtime.

### D-S1-07: Drizzle schema у `lib/db/schema/auth.ts`, окремий файл

**Чому окремо:**

- Дотримується pattern, який Phase 0 встановив для `observability.ts`: одна capability = один schema file.
- Drizzle generate створює один міграційний SQL із усіх schema-фалів → `0001_<name>.sql`. Назва вибирається автоматично з шаблону; перейменування на `0001_add_auth.sql` після generate.

### D-S1-08: Перенос `app/page.tsx` у `app/(dashboard)/page.tsx`

**Чому:**

- Existing `app/page.tsx` — Phase 0 UA-placeholder. У S1 переїжджає в `(dashboard)` route group, щоб group мала свій layout (top-bar з logout).
- `(auth)` route group має свій layout без top-bar (centered card на `/login`).
- Route groups — стандартний Next.js App Router pattern.

### D-S1-09: Login form — React Server Component + form action

**Чому:**

- Server action `signIn(formData)` — мінімальна client-side JS; `useFormState` для error display.
- Не використовуємо REST endpoint (`POST /api/login`), що зменшує поверхню атаки і узгоджується з `NFR-SEC-07` (немає webhook'ів) — той же принцип.

## Risks / Trade-offs

| #   | Risk                                                                                                                           | Mitigation                                                                                                                                                                                                                                                    |
| --- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **`proxy.ts` matcher exclude замало** — наприклад, `/_next/data/*` API запити можуть впасти у redirect, ламаючи SSR навігацію. | Розширити matcher exclude: `_next/static`, `_next/image`, `_next/data`, `favicon.ico`, `api/health`. Перевірити Chrome DevTools MCP recording до merge.                                                                                                       |
| 2   | **CSRF на server action**: Next.js server actions same-origin, SameSite=Lax cookie блокує крос-сайт POST. Достатньо для MVP.   | Документуємо у proposal scope; Phase 1 — додати explicit CSRF token, якщо вийдемо за рамки single-admin.                                                                                                                                                      |
| 3   | **Rate-limit обходиться через rotation IP** (botnet).                                                                          | Прийнятний residual ризик для single-admin системи з низькою цінністю target. Якщо помітимо abuse — додаємо global throttle (Phase 1).                                                                                                                        |
| 4   | **`@node-rs/argon2` cold start** на Vercel Fluid Compute.                                                                      | Перший login може бути ~100ms повільніший. Прийнятно для рідкісного flow. Якщо проблема — fallback на Web Crypto + `@noble/hashes/argon2id` (slower per-verify, але zero cold-start).                                                                         |
| 5   | **HTTP driver не дає `db.transaction()`** для atomic "delete failed attempts + insert success".                                | Дві окремі statement: спочатку INSERT success row, потім DELETE failed. Race-вікно невелике (єдиний admin), worst case — успіх не скине лічильник одразу, наступний логін через секунду його скине. Документуємо у `lib/auth/rate-limit.ts` коментарем "WHY". |
| 6   | **Збереження `SESSION_SECRET`** — якщо ротати, всі existing сесії invalidate-ються.                                            | Документуємо у `AGENTS.md` first-time setup; для admin-only flow це прийнятна вартість revocation-у.                                                                                                                                                          |
| 7   | **`__Host-` cookie не працює на http localhost у деяких браузерах**.                                                           | Chrome, Firefox, Safari дозволяють Secure cookies на localhost. Якщо знайдемо edge-case (Edge / старі версії) — додаємо env-перемикач `AUTH_COOKIE_PREFIX` (dev=пусто, prod=`__Host-`). Перевіряємо у Chrome DevTools MCP recording.                          |
| 8   | **Drizzle ORM на Neon HTTP** — кожен query = окремий fetch, latency ~30-80ms.                                                  | Прийнятно для login (rare path). При зростанні навантаження S6+ — перейти на `neon-serverless` Pool (вже зафіксовано як TODO у `lib/db/index.ts`).                                                                                                            |
| 9   | **Перенос існуючого `app/page.tsx`** ламає Phase 0 deploy preview.                                                             | Виконуємо одним PR разом з S1; Phase 0 deploy не вважається регресією — це частина auth-роботи.                                                                                                                                                               |
| 10  | **Hash secret leak via error message**.                                                                                        | Server actions повертають типізовану `LoginError` з одним кодом (`invalid_credentials` / `rate_limited`); ніколи не повертають raw error message клієнту. Тести перевіряють response shape.                                                                   |

## Migration Plan

**Перед merge:**

1. Згенерувати `ADMIN_PASSWORD_HASH` локально через `node scripts/hash-password.mjs` (новий скрипт), скопіювати в `vercel env add ADMIN_PASSWORD_HASH` (development / preview / production окремо).
2. Згенерувати `SESSION_SECRET` (`openssl rand -base64 48`), додати тим же шляхом.
3. Додати `ADMIN_EMAIL` (один на dev/preview/prod або різні).
4. `npm run db:generate` → `npm run db:migrate` локально на dev DB.
5. У Vercel preview: deploy → міграція автоматично через `predeploy` script (або manual `npm run db:migrate` через GHA — TBD у tasks).

**Rollback:**

- Якщо знайдено критичний bug у production: `vercel rollback` на попередній deployment + `DROP TABLE sessions; DROP TABLE login_attempts;` (через Drizzle reverse migration). Дані login_attempts / sessions не критичні — admin перелогіниться.
- Якщо проблема локальна (cookie не ставиться): можна тимчасово повернути `proxy.ts` у pass-through через `git revert <proxy commit>` і redeploy.

**Data migration:** жодних existing rows для міграції. Phase 0 → S1 — green-field у auth-частині.

## Open Questions

| ID     | Питання                                                                                                                                 | Хто резолвить              | Коли                        |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- | --------------------------- |
| Q-S1-1 | Чи Next.js 16 `proxy.ts` має `request.ip` нативно, чи треба парсити `x-forwarded-for` руками?                                           | автор, перед start of impl | Day 1 morning, before tasks |
| Q-S1-2 | Виконувати `npm run db:migrate` у CI (GHA) перед deploy, чи окремим cron-handler `app/api/internal/migrate/route.ts` з admin-only auth? | автор + design refinement  | Day 1 design refinement     |
| Q-S1-3 | Чи додати `scripts/hash-password.mjs` як ergonomic helper, чи документувати one-liner у `AGENTS.md`?                                    | автор                      | вирішується при tasks       |
| Q-S1-4 | Cleanup expired sessions / login_attempts — окремий PR Phase 1 або додаємо тут міні-cron?                                               | автор                      | вирішується при tasks       |

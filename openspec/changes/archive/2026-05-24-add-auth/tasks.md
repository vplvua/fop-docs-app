## 1. Dependencies and env scaffolding

- [x] 1.1 Add `@node-rs/argon2` to `dependencies` in `package.json`; `npm install` локально, перевірити що prebuilt napi бінарка тягнеться для darwin-arm64 і linux-x64
- [x] 1.2 Створити `scripts/hash-password.mjs` — CLI що читає пароль зі stdin (без echo) і друкує argon2id хеш; додати usage-note у `AGENTS.md` first-time setup
- [ ] 1.3 **(USER)** Згенерувати `SESSION_SECRET` (`openssl rand -base64 48`) і `ADMIN_PASSWORD_HASH` локально; додати їх + `ADMIN_EMAIL` у `vercel env add` для development / preview / production (виконує користувач, не агент — інтерактивний prompt)
- [x] 1.4 Розширити `.env.example` мінімальним прикладом значень для `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH`, `SESSION_SECRET` з коментарями "generate via …" — DONE. (Друга половина — `npx vercel env pull .env.local --yes` — виконує користувач після 1.3.)

## 2. Database schema and migration

- [x] 2.1 Створити `lib/db/schema/auth.ts` з Drizzle-таблицями `sessions(token_hash TEXT PRIMARY KEY, expires_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), ip INET)` і `login_attempts(id BIGSERIAL PRIMARY KEY, ip INET NOT NULL, attempted_at TIMESTAMPTZ NOT NULL DEFAULT now(), success BOOLEAN NOT NULL)`
- [x] 2.2 Додати індекси: `login_attempts(ip, attempted_at DESC)` для rate-limit query; `sessions(expires_at)` для майбутнього cleanup
- [x] 2.3 Re-export нових таблиць у `lib/db/schema/index.ts` (поряд з `integration_health`)
- [x] 2.4 `npm run db:generate` → перейменувати створений файл на `lib/db/migrations/0001_add_auth.sql`; вручну прочитати SQL і переконатися, що індекси / NOT NULL / DEFAULTs відповідають schema
- [x] 2.5 `npm run db:migrate` локально проти Neon dev branch (applied successfully). _Manual `db:studio` inspection lишається on user._

## 3. lib/auth — pure modules (no next/\* imports)

- [x] 3.1 `lib/auth/password.ts` — `verifyPassword(password, hash)` → `Promise<boolean>`; обгортка над `@node-rs/argon2 verify`; ловить thrown error → повертає false
- [x] 3.2 `lib/auth/session.ts` — функції `hashToken(rawToken, secret)` (base64url HMAC-SHA256), `createSession({ ip, now? })` (генерує raw token через `crypto.randomBytes(32)`, INSERT row, повертає `{ rawToken, expiresAt }`), `validateSession(rawToken, { now? })` (повертає `{ tokenHash, expiresAt } | null`), `destroySession(rawToken)` (DELETE row, безпечно якщо такого немає)
- [x] 3.3 `lib/auth/rate-limit.ts` — `checkRateLimit(ip, { now? })` (повертає `{ allowed: true } | { allowed: false, retryAfterSec }`), `recordSuccess(ip)` (INSERT success + DELETE failed для цього IP), `recordFailure(ip)` (INSERT failure); вікно і ліміт як константи MODULE_LEVEL з коментарем "see FR-AUTH-05"
- [x] 3.4 `lib/auth/cookie.ts` — експортує `SESSION_COOKIE_NAME = "__Host-session"`, `SESSION_TTL_SECONDS`, фабрики `sessionCookie(value, expires)` і `clearedSessionCookie()`
- [x] 3.5 `lib/auth/index.ts` — re-export публічних функцій; README перетворено на компактну summary-табличку модулів
- [x] 3.6 Перевірено: `grep` по `lib/auth/` не повертає жодного `next/*` import — `OK: no next/* imports in lib/auth/`

## 4. proxy.ts — real gating

- [x] 4.1 Замінити pass-through `proxy.ts` на gating: читає cookie `SESSION_COOKIE_NAME` → `validateSession(rawToken)` → null → 307 redirect на `/login?next=<encoded pathname+search>`; інакше пропускає
- [x] 4.2 У `proxy.ts` для шляху `/login`: якщо сесія валідна → 307 redirect на `/`
- [x] 4.3 Розширити matcher exclude: `_next/static`, `_next/image`, `_next/data`, `favicon.ico`, `api/health`
- [x] 4.4 Резолвити `Q-S1-1`: Next 16 `NextRequest` НЕ експонує `request.ip`/`geo` (перевірено в `node_modules/next/dist/server/web/spec-extension/request.d.ts`). Парсимо `x-forwarded-for` (Vercel перший hop = клієнт) усередині server action; в `proxy.ts` IP не потрібен — він використовується лише при `signIn`. Документовано коментарем у `proxy.ts`.

## 5. Server actions + UI

- [x] 5.1 Створити route group `app/(auth)/` з `layout.tsx` (centered card, без top-bar)
- [x] 5.2 `app/(auth)/login/page.tsx` — Server Component з заголовком "Вхід" і `<LoginForm />`
- [x] 5.3 `app/(auth)/login/login-form.tsx` — Client Component з `useActionState` (React 19 заміна `useFormState`), поля email + password, alert-блок з помилкою, disabled button під час pending; винесено `Field` і `FormAlert` піддкомпоненти для зменшення розміру і a11y асоціацій
- [x] 5.4 `app/(auth)/actions.ts` — server actions `signIn` (Zod валідація → `checkRateLimit` → `verifyPassword` → `createSession` → `cookies().set(...)` → `redirect(safeNext || "/")`) і `signOut`
- [x] 5.5 Helper `parseSafeNext(value)` живе у `lib/auth/safe-next.ts` (доступний через `lib/auth` index), використовується у `signIn` action
- [x] 5.6 Створено `app/(dashboard)/page.tsx` (заглушка з посиланням на S13) і `app/(dashboard)/layout.tsx` з top-bar (логотип + admin email + `signOut` button)
- [x] 5.7 Видалено старий `app/page.tsx` (root тепер у `(dashboard)`)
- [x] 5.8 Усі strings українською; використано доступні semantic tokens (`bg-primary`, `bg-card`, `text-foreground`, `border-border`, `text-destructive`). _Note: повноцінні DESIGN.md tokens (`colors.brand-navy`, typography scale) не вмонтовано в `globals.css` у Phase 0 — окремий tech-debt, не S1._
- [x] 5.9 Top-bar читає `process.env.ADMIN_EMAIL` (server, не з cookie)

## 6. Logging integration

- [x] 6.1 `signIn` пише `login.success` (info) і `login.failed` (warn з `email_attempted`); password не передається у payload
- [x] 6.2 У rate-limit гілці `signIn` — `login.rate_limited` (warn) з `attempts_in_window` і `retry_after_seconds`
- [x] 6.3 `signOut` пише `logout` (info) з IP
- [x] 6.4 Smoke-тест pino-логів у `npm run dev` — підтверджено всі 5 подій (`login.config_error`, `login.failed`, `login.success`, `login.rate_limited`, `logout`); жоден payload не містить `ADMIN_PASSWORD_HASH`/`SESSION_SECRET`/raw password/сесійний токен (2026-05-24)

## 7. Tests

- [x] 7.1 `tests/unit/auth/password.test.ts` — verify true/false для відомого argon2id хеша (5 кейсів)
- [x] 7.2 `tests/unit/auth/session.test.ts` + `session-db.test.ts` — `hashToken` deterministic; різні SECRET → різні hashes; create / validate (валідна / прострочена / unknown) / destroy round-trip з mocked db
- [x] 7.3 `tests/unit/auth/rate-limit.test.ts` — blocking at 10 failures; retryAfterSec ceil-rounding; `recordSuccess` скидає лічильник (6 кейсів)
- [x] 7.4 `tests/unit/auth/safe-next.test.ts` — приймає leading-slash paths; відкидає `https://`, `//`, `javascript:`, `data:`, `/\…`, empty (7 кейсів)
- [~] 7.5 **(deferred → S2)** Integration smoke на реальній Neon test-БД — конвенція з S2+, інфраструктура прокидається там
- [~] 7.6 **(skipped per user 2026-05-24)** Chrome DevTools MCP recording — пропущено; verification proof = JSON-логи з §6.4 dev smoke
- [x] 7.7 `npm run test:run` — 38/38 pass. Coverage у `lib/auth/` тепер: password 100%, safe-next 100%, cookie 100%, rate-limit 93%, session ~70% (re-exports і error branches лишаються нижче). Глобальна планка 70% не досягнута через невкритий `lib/logging/` і `lib/observability/` (Phase 0 tech debt — не S1 регресія; `npm run qa` не запускає coverage).

## 8. Quality gates + Definition of Done

- [x] 8.1 `npm run qa` локально — PASS (lint / format:check / typecheck / test:run 38/38 / build / openspec validate)
- [x] 8.2 `npx openspec validate add-auth --strict` — pass (через `openspec:validate` всередині qa)
- [~] 8.3 **(skipped per user 2026-05-24)** Demo recording — пропущено
- [x] 8.4 Оновлено `docs/current-state.md`: S1 → `done`; recent activity entry з підсумком
- [~] 8.5 **(skipped per user 2026-05-24)** PR пропускається — commit напряму в `main`. Verification log (5 pino-подій з §6.4) лишається у commit message
- [x] 8.6 `npx openspec archive add-auth` виконано в тому ж commit (див. нижче)

## 9. Post-merge hardening (optional follow-ups, винести в Phase 1 backlog якщо не встигаємо)

- [~] 9.1 **(deferred → Phase 1 backlog)** Cron auth-cleanup
- [~] 9.2 **(deferred → S13 dashboard)** `/api/health` розширення з auth_db_ok
- [~] 9.3 **(noop)** auth-spec вже доступний як infra-spec через archive

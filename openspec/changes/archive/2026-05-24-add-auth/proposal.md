## Why

Без сесії жодна сторінка адмінки не повинна відкриватися — це гейт для всіх наступних capability slices (S2 — S13). Сьогодні `proxy.ts` пропускає весь трафік (pass-through stub з Phase 0), тому система не виконує **FR-AUTH-01..06** та **NFR-SEC-02..03**. Перед тим, як вводити дані клієнтів, договори і платежі (PII, ЄДРПОУ, IBAN), потрібен робочий single-admin login з argon2id, server-side sessions і rate-limit.

## What Changes

- Сторінка `/login` (email + password) з показом помилок українською; перенаправлення на `/` після успіху.
- Server actions `signIn` / `signOut` — без публічних REST endpoints (мінімізація поверхні атаки, **NFR-SEC-07**).
- Перевірка пароля: argon2id verify проти `ADMIN_PASSWORD_HASH` з env; `ADMIN_EMAIL` — також з env (немає таблиці `users`).
- Постійні сесії: таблиця `sessions(token_hash, expires_at, created_at, ip)`; cookie HTTP-only + Secure + SameSite=Lax, 30 днів TTL; на сервері порівнюється HMAC від raw token із `SESSION_SECRET`.
- IP-rate-limit: 10 невдалих спроб login за 60 хвилин блокують подальші логіни з того ж IP до закінчення вікна; реалізовано через таблицю `login_attempts(ip, attempted_at)`.
- **BREAKING**: `proxy.ts` перестає бути pass-through — захищає всі шляхи, крім `/login`, `/api/health` та статики. Неавтентифіковані запити redirect-яться на `/login?next=<original>`.
- Порожній дашборд `app/(dashboard)/page.tsx` — заглушка з повідомленням "Підключіть інтеграції", щоб успішний логін мав куди приземлятися (повноцінна реалізація — у S13).
- Логування: `signIn` / `signOut` / rate-limit hit пишуться через `lib/logging/` (без секретів — пароль і token не логуються; redact-правила вже є з Phase 0).

## Capabilities

### New Capabilities

- `auth`: single-admin email/password login з argon2id verify, server-side sessions у Postgres, HMAC-підписаним cookie, IP-rate-limit і route-protection через `proxy.ts`.

### Modified Capabilities

- (none — `auth` створюється з нуля; інших capability-spec ще немає у `openspec/specs/`.)

## Impact

- **Code (нове):**
  - `app/(auth)/login/page.tsx` + `LoginForm` client component.
  - `app/(dashboard)/page.tsx` (тимчасова заглушка-stub).
  - `app/(auth)/actions.ts` — server actions `signIn`, `signOut`.
  - `lib/auth/` — заповнюється: `session.ts` (create/validate/destroy + HMAC), `password.ts` (argon2id verify), `rate-limit.ts` (IP-based counter), `cookie.ts` (cookie name/options), `index.ts` (re-exports).
  - `lib/db/schema/auth.ts` — таблиці `sessions`, `login_attempts`.
  - `lib/db/migrations/0001_add_auth.sql` (Drizzle generate).
- **Code (зміни):**
  - `proxy.ts` — реальний gating: redirect на `/login?next=...` для всіх неавтентифікованих запитів, окрім whitelist.
  - `app/layout.tsx` — додати top-bar з кнопкою logout, видимою тільки на захищених маршрутах.
- **Залежності (нові npm):** `argon2` (native binding) — використовується тільки в Node runtime, не в edge. Альтернатива (`@node-rs/argon2`) — обговорюється у `design.md`.
- **Env (обов'язкові з NFR-SEC-02):** `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH` (argon2id), `SESSION_SECRET` (random ≥ 32 байти). Документуються у `.env.example` (вже є з Phase 0).
- **БД:** 2 нових таблиці (`sessions`, `login_attempts`); жодних змін у `integration_health`.
- **CI / QA:** додаються unit-тести (argon2 verify, session HMAC, rate-limit counter) і E2E-тест (rate-limit after 10 fail). Без зовнішніх HTTP — MSW не потрібен у цьому зрізі.
- **Cron / Vercel:** без crons. Cleanup expired sessions і старих `login_attempts` — TODO для майбутнього (Phase 1); у MVP допустиме growth ~ десятки рядків.
- **PRD покриття:** **FR-AUTH-01..06**, **NFR-SEC-01..04**, частина **NFR-AVAIL-06** (`/api/health` лишається у whitelist).
- **Demo:** запис login success, login failure, rate-limit, logout — `docs/qa/recordings/S01-auth.{mp4|md}`.

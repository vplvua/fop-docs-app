# D-032 — Автентифікація адмінки: email/password без 2FA в MVP; credentials в env

**Дата:** 2026-05-18

**Рішення:**

1. Адмінка захищається **email/password** автентифікацією, **без 2FA в MVP**.
2. Креди адміна зберігаються в env, не в БД: `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH` (bcrypt або argon2id). Рекомендований формат — argon2id з параметрами OWASP 2024.
3. **Окрема таблиця User не вводиться** — single admin (D-001), 1 запис у БД лише дублював би env.
4. Session — server-side cookie (HTTP-only, Secure, SameSite=Lax), з збереженням токенів сесії в Postgres-таблиці `session` (HMAC token → expiration). Це дозволяє "вилогінити з усіх пристроїв" однією SQL-операцією.
5. **TLS обов'язковий** для деплою (10.3). У dev — http://localhost допускається.
6. 2FA може бути додано в Phase 2, якщо профіль ризику зміниться (наприклад, доступ до адмінки з декількох пристроїв або компроментація пароля).

**Альтернативи:**

- **email/password + 2FA TOTP від MVP.** Відкинуто: збільшує initial complexity (QR setup, recovery codes, тестування); для single admin, що працює переважно з домашньої мережі, marginal security gain. Якщо стане видно ризик — додамо явним рішенням у Phase 2.
- **OAuth через Google.** Відкинуто: зайва залежність від Google account; складніше у self-host deploy; питання "що буде, якщо Google-акаунт зламали — отримають доступ до фінансових даних".
- **User table з 1 рядком.** Відкинуто: дублює env без виграшу. Якщо колись з'явиться 2-й користувач — створимо таблицю і виженемо креди з env у БД окремим рішенням.

**Обґрунтування:**

- Single admin (D-001) — кожна ускладнююча security-фіча оцінюється проти marginal gain.
- env-only credentials узгоджуються з D-020 (secrets в env, не в БД).
- Session-таблиця в Postgres — гнучкіше за JWT-only (можна форсовано інвалідувати).

**Наслідки:**

- В моделі — нова службова таблиця `Session` (token_hash, expires_at, created_at). Не вважається бізнес-сутністю, тому не моделюється в `domain_model.md` детально.
- Нові env-змінні: `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH`, `SESSION_SECRET` (для HMAC підпису токенів).
- В PRD 8.8 — опис flow.
- В PRD 10.3 — env-список доповнюється.

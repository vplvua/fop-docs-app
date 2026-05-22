# Demo recordings

Демо-записи для кожного завершеного capability slice. Частина Definition of Done ([`../../mvp-capability-plan.md § 6`](../../mvp-capability-plan.md)).

## Іменування

`S<NN>-<slice-name>.<ext>`

Приклади:

- `S1-auth.mp4` — login, logout, rate-limit
- `S8-acts.mp4` — повний пайплайн: класифікований платіж → акт з PDF у Blob → завантажений з UI

Якщо відео завеликий для git — `S<NN>-<slice-name>.md` зі screenshots + текстовими кроками. Великі відео виносимо у Vercel Blob або зовнішній storage; у `.md` записуємо публічне посилання.

## Що має бути в записі

- Старт з валідного стану системи (логін, дашборд).
- Demo critеria з відповідного capability section у `mvp-capability-plan.md § 5`.
- Edge case або negative test (якщо релевантний для зрізу — наприклад, для S1 показати rate-limit).
- Підтвердження `current-state.md` оновлення (можна показати diff коміту).

## Що НЕ має бути

- Реальних PII (ЄДРПОУ клієнтів, IBAN, email) — використовуй staging-fixtures.
- Реальних токенів і паролів у кадрі.

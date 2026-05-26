# Architectural Decision Records

Журнал архітектурних і продуктових рішень з обґрунтуваннями. Кожне рішення — окремий файл з префіксом `D-NNN-<slug>.md`. Записи immutable: якщо рішення переглядається, **створюємо новий ADR** з полем `**Переглядає:** D-XXX`, не редагуємо старий.

## Структура запису

- **Рішення** — що вирішили (1-2 речення).
- **Альтернативи** — що ще розглядали і чому відкинули.
- **Обґрунтування** — чому саме так.
- **Наслідки** — як це впливає на модель, код, процес.
- **Дата** — коли прийнято.
- **Переглядає** (опціонально) — D-XXX-посилання на попередній ADR, який ця запис заміняє/уточнює.

## Як додати новий ADR

1. Створи файл `D-037-<slug>.md` (наступний номер у послідовності).
2. Використай шаблон зі структури вище.
3. Додай рядок у таблицю нижче.
4. Якщо ADR переглядає попередній — у старому ADR залишай зміст незмінним; новий ADR явно вказує `**Переглядає:** D-XXX`.

## Індекс

| ID    | Тема                                                                               | Файл                                                                 |
| ----- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| D-001 | Скоуп MVP: тільки автоматизація актів                                              | [D-001-mvp-scope.md](D-001-mvp-scope.md)                             |
| D-002 | Не використовуємо інвойси                                                          | [D-002-no-invoices.md](D-002-no-invoices.md)                         |
| D-003 | Список виключень для нестандартних клієнтів (`auto_act_disabled`)                  | [D-003-exclusion-list.md](D-003-exclusion-list.md)                   |
| D-004 | Локальна БД, sync з MySQL "Моє ОСББ" тільки на читання                             | [D-004-local-db-sync.md](D-004-local-db-sync.md)                     |
| D-005 | Нумерація актів окрема для кожного клієнта                                         | [D-005-act-numbering.md](D-005-act-numbering.md)                     |
| D-006 | Дата акту = останній день місяця платежу                                           | [D-006-act-date.md](D-006-act-date.md)                               |
| D-007 | Один платіж = один акт (без агрегації)                                             | [D-007-one-payment-one-act.md](D-007-one-payment-one-act.md)         |
| D-008 | Транзитний рахунок ПриватБанку як спеціальний випадок                              | [D-008-transit-account.md](D-008-transit-account.md)                 |
| D-009 | Двофакторний матчинг клієнта: договір + ЄДРПОУ                                     | [D-009-two-factor-matching.md](D-009-two-factor-matching.md)         |
| D-010 | Поле `quantity` і `quantity_unit` в акті                                           | [D-010-quantity-field.md](D-010-quantity-field.md)                   |
| D-011 | Створення локального клієнта без `moeosbb_user_id`                                 | [D-011-local-client.md](D-011-local-client.md)                       |
| D-012 | `apartments_count` заповнюється вручну, не з MySQL                                 | [D-012-apartments-count-manual.md](D-012-apartments-count-manual.md) |
| D-013 | Сторінка тарифів одразу, не як Phase 2                                             | [D-013-tariffs-page.md](D-013-tariffs-page.md)                       |
| D-014 | `Payment.status`: 5 станів, `awaiting_review` окремо від `in_queue`                | [D-014-payment-status.md](D-014-payment-status.md)                   |
| D-015 | Бренд-нейтральні поля EDO замість `vchasno_*`                                      | [D-015-edo-brand-neutral.md](D-015-edo-brand-neutral.md)             |
| D-016 | `service_type`: видалити `custom`, додати `other` з ручним описом                  | [D-016-service-type-other.md](D-016-service-type-other.md)           |
| D-017 | Перевірка повноти даних клієнта (умовна для `apartments_count`)                    | [D-017-completeness-check.md](D-017-completeness-check.md)           |
| D-018 | Видалити `Tariff.is_default`; інваріант "сітка завжди має catch-all"               | [D-018-tariff-catchall.md](D-018-tariff-catchall.md)                 |
| D-019 | Cardinality `Client↔Contract`: 1:0..1; договір обов'язковий перед актом            | [D-019-contract-cardinality.md](D-019-contract-cardinality.md)       |
| D-020 | Credentials виносяться з `Settings` у env                                          | [D-020-credentials-env.md](D-020-credentials-env.md)                 |
| D-021 | Перейменування `mosbb_*` → `moeosbb_*`                                             | [D-021-moeosbb-rename.md](D-021-moeosbb-rename.md)                   |
| D-022 | Розширити `client_incomplete`: `bank_name` і `bank_account` обов'язкові            | [D-022-bank-required.md](D-022-bank-required.md)                     |
| D-023 | Sync "Моє ОСББ": enum-розклад (first/last/manual) + ручна кнопка                   | [D-023-sync-schedule.md](D-023-sync-schedule.md)                     |
| D-024 | Двигун локальної БД: PostgreSQL                                                    | [D-024-postgres.md](D-024-postgres.md)                               |
| D-025 | ON DELETE: RESTRICT для `Client`/`Contract`; архівування через `auto_act_disabled` | [D-025-on-delete-restrict.md](D-025-on-delete-restrict.md)           |
| D-026 | Версіонування `sms_unit_price` у окремій таблиці `SmsPrice`                        | [D-026-sms-price.md](D-026-sms-price.md)                             |
| D-027 | Кілька номерів договору в одному purpose → `in_queue(multiple_contracts)`          | [D-027-multiple-contracts.md](D-027-multiple-contracts.md)           |
| D-028 | PDF актів генерується локально через headless browser                              | [D-028-pdf-local.md](D-028-pdf-local.md)                             |
| D-029 | Дубідок integration: inline participants, polling-only статуси, Premium            | [D-029-dubidoc-integration.md](D-029-dubidoc-integration.md)         |
| D-030 | Алерти про проблеми системи: банер у адмінці, без push-каналу                      | [D-030-alerts-banner.md](D-030-alerts-banner.md)                     |
| D-031 | Стек адмінки: Next.js (App Router) + Tailwind + shadcn/ui                          | [D-031-admin-stack.md](D-031-admin-stack.md)                         |
| D-032 | Автентифікація адмінки: email/password без 2FA в MVP                               | [D-032-auth.md](D-032-auth.md)                                       |
| D-033 | Розділ "Договори" в адмінці: повноцінний CRUD                                      | [D-033-contracts-section.md](D-033-contracts-section.md)             |
| D-034 | Хостинг і інфраструктура: Vercel + Neon Postgres + Vercel Blob                     | [D-034-vercel-hosting.md](D-034-vercel-hosting.md)                   |
| D-035 | CI/CD: GitHub + Vercel auto-deploy; GitHub Actions для тестів і lint               | [D-035-cicd.md](D-035-cicd.md)                                       |
| D-036 | Зовнішнє ЕДО (Вчасно): `vchasno_external` як другий канал оформлення актів         | [D-036-vchasno-external.md](D-036-vchasno-external.md)               |
| D-037 | Quality gates stack: oxlint + prettier + vitest + qa-verify + hooks + RBP          | [D-037-quality-gates-stack.md](D-037-quality-gates-stack.md)         |
| D-038 | Drizzle ORM як шар доступу до Postgres                                             | [D-038-drizzle-orm.md](D-038-drizzle-orm.md)                         |
| D-039 | MSW як єдина стратегія HTTP-моків у тестах                                         | [D-039-test-http-mocks.md](D-039-test-http-mocks.md)                 |
| D-040 | PDF генерація напряму з server action, без HTTP-hop                                | [D-040-pdf-direct-call.md](D-040-pdf-direct-call.md)                 |

## Як посилатись на ADR

- У PRD, специфікаціях, коментарях коду — короткий ID, наприклад `(D-024)` або `(див. D-024)`.
- У документах markdown — повне посилання, наприклад `[D-024](docs/adr/D-024-postgres.md)`.
- У коді — коментар з ID без шляху (`// D-024: jsonb замість text для snapshot`).

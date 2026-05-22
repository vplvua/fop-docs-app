# Changelog: domain_model.md

Технічний журнал правок доменної моделі — перейменування полів, видалення enum-значень, узгодження термінології. Бізнес/архітектурні рішення з обґрунтуванням — в `adr/`.

Формат: [Keep a Changelog](https://keepachangelog.com/), версії за SemVer (відносно `domain-model.md`).

Записи від найновіших до найстаріших.

---

## [Unreleased]

### Added

- (тут опишемо, що додано в наступному релізі)

### Changed

- (rename полів, зміна типу, зміна enum)

### Removed

- (видалені поля, enum-значення)

### Fixed

- (виправлені неузгодженості з decisions_log або PRD_skeleton)

---

## [0.10.0] — 2026-05-19

Підтримка зовнішнього ЕДО (Вчасно) як другого каналу оформлення актів. Підстава: D-036 (переглядає D-015 в частині "модель не підтримує кілька EDO").

### Added

- Новий PostgreSQL ENUM `edo_provider AS ENUM ('dubidoc', 'vchasno_external')`.
- Поле `Client.edo_provider` (enum, default `dubidoc`, origin: `manual`). Sync з "Моє ОСББ" не торкає.
- Поле `Act.edo_provider` як snapshot (копіюється з `client.edo_provider` при генерації акту). Додано до переліку snapshot-полів акту.
- Значення `external_edo` в enum `classification_reason` (належить до `awaiting_review`).
- Крок 3b у логіці класифікації після `auto_act_disabled`: якщо `client.edo_provider = vchasno_external`, повертаємо `awaiting_review(reason=external_edo)`.
- Гілка `edo_provider=vchasno_external` у state machine Act: `draft → signed` через ручну дію "Позначити підписаним". Перехід `sent_to_edo` і `deleted` не застосовні.
- Підрозділ "Вчасно (зовнішнє ЕДО, без API-інтеграції)" в "Інтеграціях" з описом ручного workflow.
- В огляд процесу додано дві гілки після створення акту залежно від `edo_provider`.

### Changed

- Опис `Act.edo_doc_id` і `Act.edo_status`: для `edo_provider=vchasno_external` завжди NULL.
- Опис `Act.status` значень: `sent_to_edo` і `deleted` тепер позначені як "не застосовно для `vchasno_external`"; `signed` — джерело події різне для двох гілок (polling Дубідок vs ручна дія адміна).
- Опис переходів Payment lifecycle: `received → awaiting_review` тепер охоплює як `auto_act_disabled`, так і `external_edo`.
- Дубідок API в "Інтеграціях": тепер явно прив'язано до `client.edo_provider = dubidoc`.
- Правило sync з "Моє ОСББ": `edo_provider` додано до списку полів, що НІКОЛИ не перезаписуються sync-ом (поряд з `apartments_count`, `access_price_override`, `auto_act_disabled`).
- Крок 8 псевдокоду класифікації: створення акту явно бере `edo_provider` зі snapshot-у клієнта; `send_to_edo` викликається тільки якщо `act.edo_provider = dubidoc`.

---

## [0.9.1] — 2026-05-18

Уточнення інтеграції з Дубідок (polling-only). Підстава: D-029.

### Added

- Ключ `Settings.dubidoc_poll_interval_hours` (default 6) — інтервал polling статусу актів у Дубідок.

### Changed

- `Act.edo_status`: тип з `edo_status` ENUM → `text` (nullable). Зберігаємо raw-значення Дубідок без типізації, бо набір статусів Дубідок занадто широкий і нестабільний.
- Перейменування `Settings.polling_interval_minutes` → `Settings.privatbank_polling_interval_minutes` для однозначності.

### Removed

- ENUM type `edo_status` з PostgreSQL declarations — поле `Act.edo_status` тепер `text`.

---

## [0.9] — 2026-05-18

Обробка кількох знайдених номерів договору в одному purpose. Підстава: D-027.

### Added

- Значення `multiple_contracts` в enum `classification_reason` (належить до `in_queue`).
- Крок dedup після парсингу: `parsed_contract_numbers = unique(parsed_contract_numbers)`.
- Перевірка `len(parsed_contract_numbers) > 1` → `in_queue(multiple_contracts)`. Виконується між кроком 1 (парсинг) і кроком 2 (матчинг).

### Changed

- Крок 2 псевдокоду (матчинг клієнта): замість `parsed_contract_numbers[0]` використовується змінна `contract_number` (єдиний номер після dedup і перевірки).

---

## [0.8] — 2026-05-18

Версіонування ціни СМС у часі через окрему сутність. Підстава: D-026.

### Added

- Нова сутність `SmsPrice` (id, price, effective_from, created_at) — симетрично до `Tariff`.
- Псевдокод `resolve_sms_price(payment_date)`.
- Інваріант: `sms_prices` завжди містить принаймні один рядок з `effective_from <=` дати першого платежу в системі.

### Changed

- В кроці 6 псевдокоду класифікації для `service_type=sms`: `unit_price = settings.sms_unit_price_at(...)` → `unit_price = resolve_sms_price(payment.date)`.

### Removed

- Ключ `Settings.sms_unit_price` — переноситься у таблицю `SmsPrice`.
- Ключ `Settings.sms_unit_price_effective_from` — переноситься у таблицю `SmsPrice`.

---

## [0.7.2] — 2026-05-18

Додано явну ON DELETE поведінку до всіх FK моделі. Підстава: D-025.

### Added

- Підрозділ "FK поведінка (ON DELETE)" з таблицею правил.
- В описі `Client.auto_act_disabled` — згадка про використання як ознаки архіву в UI 8.4.

### Changed

- В таблицях сутностей `Contract`, `Payment`, `Act` колонка "Тип" для FK-полів містить ON DELETE правило (RESTRICT або SET NULL).

---

## [0.7.1] — 2026-05-18

Уточнення типів полів під PostgreSQL як обраний двигун БД. Підстава: D-024.

### Added

- В шапку файлу — рядок "Двигун БД: PostgreSQL (D-024)".
- Підрозділ "PostgreSQL ENUM types" з декларацією всіх native ENUM (`payment_status`, `act_status`, `service_type`, `classification_reason`, `classified_by`, `edo_status`, `moeosbb_sync_schedule`).

### Changed

- Типи полів у таблицях сутностей уточнено в PostgreSQL-нотації:
  - `UUID/INT` → `uuid` для PK; `bigint` для `moeosbb_user_id`
  - `string` → `text`
  - `int` → `integer` (числові поля) або `bigint` (зовнішні ID)
  - `decimal` → `numeric(10,2)` для цін, `numeric(12,2)` для сум
  - `JSON` → `jsonb`
  - `bool` → `boolean`
  - `timestamp` → `timestamptz`
  - `enum` → посилання на native ENUM type, оголошений в підрозділі ENUM types
- В Contract додано рядок `created_at`, `updated_at` (відсутній раніше, узгоджується з іншими сутностями).
- В Tariff `apartments_max` опис: "NULL = 'і більше'" → "NULL = 'і більше' (catch-all)" — узгодження з D-018.

---

## [0.7] — 2026-05-17

Зміна розкладу sync з MySQL "Моє ОСББ": з "раз на день" на enum-розклад (first/last/manual) + ручна кнопка. Підстава: D-023.

### Added

- Ключ `Settings.moeosbb_sync_schedule` (enum: `first` | `last` | `manual`, default `first`) — розклад автосинхронізації з БД "Моє ОСББ".
- В описі sync-механізму — згадка про ручну кнопку "Синхронізувати зараз" (UI 8.7), що працює незалежно від автоматичного розкладу.

### Changed

- Формулювання "Періодичний sync клієнтів (раз на день)" в розділі "MySQL Моє ОСББ (read-only)" замінено на опис за розкладом `settings.moeosbb_sync_schedule`.

---

## [0.6.3] — 2026-05-17

Розширення перевірки `client_incomplete` двома новими обов'язковими полями. Підстава: D-022.

### Added

- В кроці 5 псевдокоду класифікації — перевірки `client.bank_name` і `client.bank_account`. Без них генерація акту блокується (`in_queue(client_incomplete, missing=[...])`).

### Changed

- Логічний набір обов'язкових полів клієнта для генерації акту: `email`, `address`, `bank_name`, `bank_account`, `contract` + `apartments_count` (умовно для access без override).

---

## [0.6.2] — 2026-05-17

Системне виправлення транслітерації префіксу `mosbb_` → `moeosbb_` + перейменування `mosbb_client_id` → `moeosbb_user_id`. Підстава: D-021.

### Changed

- `Client.mosbb_client_id` → `Client.moeosbb_user_id` (rename + правка typo).
- В sync-правилах і описі `Contract.number` — використовується нова назва поля.
- Env-змінна `MOSBB_DB_URL` → `MOEOSBB_DB_URL` (актуалізує D-020).
- Історичні згадки в decisions_log (D-004, D-011, D-019, D-020) і в попередньому CHANGELOG-записі [0.6.1] оновлено з новими назвами.

### Fixed

- Орфографічна помилка в префіксі `mosbb_` (пропущена `e` від "Моє").
- Невідповідність назви FK-поля реальній таблиці в БД "Моє ОСББ" (`osbb_users`, не `osbb_clients`).

---

## [0.6.1] — 2026-05-17

Видалення credentials з таблиці Settings. Підстава: D-020.

### Removed

- Ключ `privatbank_token` з Settings — переноситься в env як `PRIVATBANK_TOKEN`.
- Ключ `dubidoc_token` з Settings — переноситься в env як `DUBIDOC_TOKEN`.
- Ключ `moeosbb_db_credentials` з Settings — переноситься в env як `MOEOSBB_DB_URL` (одна connection string).

### Added

- Примітка в розділі Settings про env-зберігання credentials і перелік обов'язкових змінних оточення.

---

## [0.6] — 2026-05-17

Договір обов'язковий перед генерацією акту; snapshot номера і дати договору в акт; cardinality Client↔Contract стає 1:0..1. Підстава: D-019.

### Added

- Поле `Act.contract_snapshot` (JSON, not null) — snapshot номера і дати договору на момент генерації акту.
- Перевірка наявності договору в кроці 5 логіки класифікації: `IF client.contract IS NULL: missing.append("contract")`.
- Приклад JSON структури `contract_snapshot` поряд з `client_snapshot`.

### Changed

- Cardinality Client ↔ Contract: з `1:1` (один клієнт = один договір) на `1:0..1` (клієнт може існувати без договору тимчасово, але акти для нього заблоковані).
- Список snapshot-полів Act розширено: тепер `unit_price, quantity, client_snapshot, contract_snapshot`.

---

## [0.5] — 2026-05-17

Видалення поля `Tariff.is_default` і спрощення логіки резолву ціни. Підстава: D-018.

### Removed

- Поле `Tariff.is_default` (bool) — функція покривається інваріантом "сітка завжди має catch-all правило".
- Гілка "Fallback — default tariff" з псевдокоду `resolve_access_price` — стала непотрібною після D-017 (apartments_count обов'язковий для access без override) і D-018 (catch-all правило завжди існує).

### Added

- Інваріант тарифної сітки: завжди рівно одне catch-all правило з `apartments_max IS NULL`. Валідація — на рівні CRUD адмінки.
- Опис пріоритезації при множинному матчингу: ranged перед catch-all → вужчий діапазон перед ширшим → новіше effective_from перед старішим.

### Changed

- Стартова конфігурація сітки: `{apartments_min=0, apartments_max=NULL, price=200}` без поля `is_default`.

---

## [0.4] — 2026-05-17

Перебудова порядку кроків логіки класифікації + диференціація умови `client_incomplete`. Підстава: D-017.

### Changed

- Перевірка повноти даних клієнта перенесена з кінця класифікації (старий крок 7) на середину (новий крок 5) — ДО резолву ціни. Це усуває fake-розрахунок з fallback tariff при відсутності `apartments_count`.
- Умова `apartments_count` обов'язковості тепер залежна від контексту: тільки для `service_type = access` без `access_price_override`. Для sms, other, або access з override — apartments_count не потрібен.
- Перенумерація кроків псевдокоду: 5=повнота даних, 6=резолв ціни (був 5), 7=quantity (був 6), 8=акт (без змін).

### Removed

- Старий крок 7 (`IF NOT (email AND apartments_count AND address): in_queue`) видалено — його логіка інтегрована в крок 5 з диференційованою умовою.

---

## [0.3] — 2026-05-17

Перегляд enum `service_type` і додавання поля `Act.service_description`. Підстава: D-016.

### Added

- Поле `Act.service_description` (string, not null) — human-readable опис послуги для рендеру в PDF.
- Enum value `service_type = other` для нестандартних послуг, що присвоюється тільки вручну адміном.

### Removed

- Enum value `service_type = custom` — був dead code, до нього не вело жодне правило класифікації.

### Changed

- В псевдокоді логіки класифікації (крок 4) додано коментар, що автокласифікація повертає тільки `access` або `sms`. `other` — виключно ручний.

---

## [0.2.1] — 2026-05-17

Косметичне перейменування полів EDO. Підстава: D-015.

### Changed

- `Contract.vchasno_doc_id` → `Contract.edo_doc_id`.
- `Act.vchasno_doc_id` → `Act.edo_doc_id`.
- `Act.vchasno_status` → `Act.edo_status`.
- `Act.status = sent_to_vchasno` → `Act.status = sent_to_edo` (enum value).
- `Settings.vchasno_token` → `Settings.dubidoc_token` (виняток для credential, що лишається vendor-specific).
- В описах полів і state machine терміни "Дубідок" і "EDO" розрізняються: абстракція → EDO, конкретний провайдер → Дубідок.

### Fixed

- Бренд-неузгодженість: vchasno\_\* поля для продукту "Дубідок". Vchasno (від EVO) і Дубідок (від ПриватБанку) — різні сервіси, плутати критично.

---

## [0.2] — 2026-05-17

Розширення enum `Payment.status` з 4 до 5 значень. Підстава: D-014.

### Added

- `Payment.status = awaiting_review` — новий стан для платежів від клієнтів з `auto_act_disabled = true`.
- В state machine Payment — гілка `received → awaiting_review` і відповідні переходи `awaiting_review → classified | skipped`.

### Changed

- `Payment.classification_reason` тепер логічно розділено: `auto_act_disabled` належить до `awaiting_review`, решта reasons — до `in_queue`.
- Крок 3 в псевдокоді логіки класифікації (`auto_act_disabled` гілка) повертає `awaiting_review` замість `in_queue`.
- `prd-rationale.md` рядок 65 узгоджено з моделлю (було `processed`, стало `skipped` + додано `awaiting_review`).

### Fixed

- Неузгодженість `Payment.status` enum між `domain-model.md` (`skipped`) і `prd-rationale.md` (`processed`).

---

## [0.1] — 2026-05-17

Початкова версія доменної моделі, винесена з обговорень у Claude.ai в локальний репозиторій.

### Added

- Сутності: `Client`, `Contract`, `Payment`, `Act`, `Tariff`, `Settings`.
- State machines для `Payment` і `Act`.
- Псевдокод логіки класифікації платежу.
- Псевдокод генерації номера акту.
- Псевдокод резолву ціни (override → tariff grid → default).
- Стартовий набір regex-патернів для парсингу номера договору.

# PRD: Система автоматичної генерації актів виконаних робіт

**Версія:** 1.0 (структурована форма за шаблоном FR/NFR/TC/BC)
**Автор:** Василь Пашко
**Дата:** 2026-05-22
**Статус:** draft
**Джерело:** [`docs/prd-rationale.md`](prd-rationale.md) — повна версія з обґрунтуваннями

---

## 0. Як читати документ

Вимоги згруповані за чотирма категоріями. Кожна вимога має унікальний ідентифікатор у форматі `<ПРЕФІКС>-<ДОМЕН>-<NN>`.

| Префікс | Що означає                 | Приклад                                                    |
| ------- | -------------------------- | ---------------------------------------------------------- |
| `FR-*`  | Functional Requirement     | `FR-AUTH-01: користувач логіниться через email + password` |
| `NFR-*` | Non-Functional Requirement | `NFR-PERF-01: класифікація платежу < 2 с`                  |
| `TC-*`  | Technical Constraint       | `TC-STACK-01: Next.js App Router, TypeScript strict`       |
| `BC-*`  | Business Constraint        | `BC-LEGAL-01: акт виставляється за фактом оплати`          |

Скорочення доменів: `AUTH` (auth), `PAY` (платежі), `CLASS` (класифікація), `CLI` (клієнти), `CTR` (договори), `ACT` (акти), `TAR` (тарифи), `EDO` (ЕДО), `SYNC` (sync), `QUEUE` (черга), `UI` (інтерфейс), `SET` (налаштування), `PERF`, `SEC`, `LOG`, `AVAIL`, `STACK`, `HOST`, `DB`, `INTEG`, `LEGAL`, `DATA`, `USER`, `SCOPE`.

Деталі сценаріїв, обґрунтування і edge cases — у [`prd-rationale.md`](prd-rationale.md). Цей документ є нормативним переліком вимог.

---

## 1. Контекст і цілі

**Продукт:** автоматизація виставлення актів виконаних робіт для ФОП-3 єдиного податку, який надає послугу доступу до сервісу "Моє ОСББ" і додаткову СМС-розсилку. Цільовий масштаб — до 300 клієнтів, до 500 платежів/місяць.

**Цільові показники успіху:**

| Метрика                                                         | Поточне      | Цільове    |
| --------------------------------------------------------------- | ------------ | ---------- |
| % платежів, автокласифікованих без втручання адміна             | 0            | ≥ 90%      |
| Час від отримання платежу банком до акту в Дубідок (happy path) | години-тижні | < 1 година |
| Ручна робота адміна на місяць                                   | 8-15 годин   | < 1 година |
| Помилки в реквізитах акту на місяць                             | кілька       | < 1        |

---

## 2. Бізнес-обмеження (BC-\*)

### 2.1 Юридичні (`BC-LEGAL-*`)

- **BC-LEGAL-01:** Один платіж = один акт виконаних робіт (cardinality 1:1). Розщеплення одного платежу на кілька актів не підтримується.
- **BC-LEGAL-02:** Дата акту = останній календарний день місяця платежу (наприклад, платіж 5 квітня → акт 30 квітня).
- **BC-LEGAL-03:** Акт виставляється **за фактом оплати**, не за фактом надання послуги (ФОП 3 група ЄП).
- **BC-LEGAL-04:** Підпис акту здійснює власник вручну у UI Дубідок (для каналу `dubidoc`) або у UI Вчасно (для каналу `vchasno_external`); система не виконує автопідпис.
- **BC-LEGAL-05:** Підписаний акт є юридичним документом — historical snapshot реквізитів і ціни в акті immutable.
- **BC-LEGAL-06:** Електронний підпис у Дубідок не дозволяє підписати документ до настання його дати.

### 2.2 Дані (`BC-DATA-*`)

- **BC-DATA-01:** Усі дані клієнтів (PII, ЄДРПОУ, IBAN, email) зберігаються в межах юрисдикції, доступної ФОПу України; персональні дані резервуються разом із БД.
- **BC-DATA-02:** Жодних write-операцій у БД "Моє ОСББ" система не виконує — інтеграція **read-only**.
- **BC-DATA-03:** Видалити клієнта/договір/акт з історії платежами неможливо (FK `RESTRICT`); приховування — через `auto_act_disabled = true`.
- **BC-DATA-04:** Реквізити акту (`client_snapshot`, `contract_snapshot`, `unit_price`, `quantity`, `edo_provider`) фіксуються snapshot-ом у момент створення акту і не оновлюються при зміні джерела.

### 2.3 Користувачі (`BC-USER-*`)

- **BC-USER-01:** Єдиний користувач системи — Адмін (= автор = власник ФОП). Multi-admin поза скоупом MVP.
- **BC-USER-02:** Клієнти ОСББ отримують підписані акти на email, але не мають доступу до адмінки.
- **BC-USER-03:** Адмін має повний CRUD-доступ до усіх сутностей, крім sync-полів `Client` та полів `apartments_count`, `auto_act_disabled`, `access_price_override`, `edo_provider`, які залишаються manual-only.

### 2.4 Скоуп (`BC-SCOPE-*`)

- **BC-SCOPE-01:** Виставлення інвойсів і цикл "очікуваний платіж → нагадування" поза скоупом.
- **BC-SCOPE-02:** Зміни в БД "Моє ОСББ" поза скоупом.
- **BC-SCOPE-03:** Обробка історичних платежів до дати запуску системи поза скоупом.
- **BC-SCOPE-04:** Звітність ФОП, ЄП-розрахунок, податкова звітність поза скоупом.
- **BC-SCOPE-05:** Облік оплачених періодів / продовження доступу клієнта в "Моє ОСББ" і облік балансу СМС поза скоупом — це ручна операція автора.
- **BC-SCOPE-06:** Bulk-перевипуск історичних актів при зміні реквізитів поза скоупом.
- **BC-SCOPE-07:** Fuzzy-матч по ПІБ для транзитних рахунків поза MVP.
- **BC-SCOPE-08:** Webhook від Дубідок поза MVP (тільки polling).
- **BC-SCOPE-09:** Push-канали алертів (Telegram/email) поза MVP — тільки банер у UI.
- **BC-SCOPE-10:** 2FA поза MVP (тільки email/password).
- **BC-SCOPE-11:** API-інтеграція з Вчасно поза MVP (тільки ручний канал `vchasno_external`).

---

## 3. Функціональні вимоги (FR-\*)

### 3.1 Авторизація (`FR-AUTH-*`)

- **FR-AUTH-01:** Адмін логіниться через email + password на сторінці `/login`.
- **FR-AUTH-02:** Облікові дані зберігаються в env (`ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH` як argon2id), окремої таблиці User немає.
- **FR-AUTH-03:** Session — HMAC-підписаний токен у Postgres-таблиці `session` + HTTP-only Secure SameSite=Lax cookie; expiration 30 днів.
- **FR-AUTH-04:** Logout видаляє session-row у БД і clears cookie.
- **FR-AUTH-05:** Rate-limit на login — максимум 10 спроб/година з одного IP.
- **FR-AUTH-06:** Усі маршрути адмінки, крім `/login` і `/api/health`, вимагають активної сесії.

### 3.2 Polling платежів ПриватБанку (`FR-PAY-*`)

- **FR-PAY-01:** Cron-задача викликає ПриватБанк Автоклієнт API на інтервалі `Settings.privatbank_polling_interval_minutes` (default 60).
- **FR-PAY-02:** Кожен запит бере overlapping період (`≈ 2 × interval`) для покриття разових мережевих збоїв.
- **FR-PAY-03:** Запис у `Payment` виконується через `INSERT ... ON CONFLICT (bank_transaction_id) DO NOTHING` для idempotency.
- **FR-PAY-04:** Зберігаємо повний payload ПриватБанку в `Payment.raw_data` (jsonb); повторне отримання не оновлює `raw_data` (перша версія канонічна).
- **FR-PAY-05:** Мапінг полів API → `Payment`: id → `bank_transaction_id`, date → `payment_date`, amount → `amount`, purpose → `purpose`, payer.name → `payer_name`, payer.legal_id → `payer_legal_id`, payer.iban → `payer_bank_account`.
- **FR-PAY-06:** При `401` polling зупиняється до перевипуску токена; при `5xx`/network — 3 retries з backoff (1с / 5с / 30с); при `429` — respect Retry-After.
- **FR-PAY-07:** 4+ послідовних провали polling-у відображаються банером на дашборді з типом помилки і часом останнього успішного polling-у.
- **FR-PAY-08:** Кнопка "Синхронізувати ПриватБанк зараз" на дашборді запускає polling поза розкладом.

### 3.3 Класифікація платежу (`FR-CLASS-*`)

- **FR-CLASS-01:** Класифікація запускається на кожному `Payment.status = received` і на ручному reclassify (`awaiting_review` / `in_queue`).
- **FR-CLASS-02:** Класифікатор виконує кроки в порядку: парсинг номера договору → матчинг клієнта (EDRPOU-first, D-041) → перевірка `auto_act_disabled` → перевірка `edo_provider` → визначення `service_type` → перевірка повноти даних → резолв ціни → визначення `quantity` → генерація `Act`.
- **FR-CLASS-03:** Парсинг номера договору застосовує всі regex з `Settings.contract_regex_patterns`; результати дедуплікуються по значенню.
- **FR-CLASS-04:** Номер договору блокує як `in_queue(multiple_contracts)` лише коли він реально розрізнює клієнтів (транзит або >1 активний клієнт з тим самим ЄДРПОУ) і знайдено >1 різних номерів. Якщо ЄДРПОУ однозначно вказує одного активного клієнта — кілька номерів інформативні й не блокують (D-027, D-041).
- **FR-CLASS-05:** Матчинг клієнта — EDRPOU-first (D-041): первинний фактор — `payer_legal_id`. Серед клієнтів з цим ЄДРПОУ розглядаються активні (`auto_act_disabled = false`). Рівно 1 активний → matched (номер договору не обовʼязковий). >1 активний → розрізнення по договору; якщо не розрізнюється — `awaiting_review(multiple_clients_same_edrpou)` з селектором активних. Архівовані не беруть участі у виборі (виняток — коли вони єдині на ЄДРПОУ, див. FR-CLASS-08).
- **FR-CLASS-06:** Для платежів з транзитного рахунку (`payer_legal_id ∈ Settings.transit_edrpou_list`) матчинг тільки за номером договору серед активних клієнтів, без перевірки ЄДРПОУ.
- **FR-CLASS-07:** Якщо жоден клієнт не має ЄДРПОУ платника — `in_queue(no_match)`. Ручна привʼязка платежу до клієнта дозволена лише в межах того самого ЄДРПОУ (виняток — транзит за договором).
- **FR-CLASS-08:** Якщо `client.auto_act_disabled = true` — `awaiting_review(auto_act_disabled)`, авто-генерація акту блокується.
- **FR-CLASS-09:** Якщо `client.edo_provider = vchasno_external` — `awaiting_review(external_edo)`, авто-відправка в Дубідок не виконується.
- **FR-CLASS-10:** При одночасному `auto_act_disabled = true` і `edo_provider = vchasno_external` пріоритет має `auto_act_disabled`.
- **FR-CLASS-11:** Авто-визначення `service_type`: якщо `purpose.lower()` містить хоча б одне ключове слово зі `Settings.sms_keywords` → `sms`; інакше → `access`. Значення `other` присвоюється тільки вручну.
- **FR-CLASS-12:** Перед резолвом ціни перевіряється повнота даних клієнта; missing-список (email, address, bank_name, bank_account, contract, apartments_count для access без override) обчислюється UI на льоту і повертає `in_queue(client_incomplete)`.
- **FR-CLASS-13:** Для `service_type = access`: якщо `payment.amount % unit_price != 0` — `in_queue(amount_mismatch)`; інакше `quantity = amount / unit_price`, `quantity_unit = "міс."`.
- **FR-CLASS-14:** Для `service_type = sms`: `quantity` парситься з `purpose` (наприклад, "у кількості 100"); якщо `parsed_quantity × unit_price != amount` — `in_queue(sms_quantity_mismatch)`.
- **FR-CLASS-15:** Класифікація обгорнута в Postgres-транзакцію з `SELECT ... FOR UPDATE` на `Payment` — паралельні запуски однієї транзакції чекають.
- **FR-CLASS-16:** При успішній класифікації встановлюється `Payment.status = classified`, `Payment.act_id = <new_act.id>`; стани `Payment` і `Act` змінюються атомарно.
- **FR-CLASS-17:** Платіж зі status `classified` не може бути повторно класифікований (форма ручної класифікації недоступна в UI).
- **FR-CLASS-18:** Ручне позначення платежу як `skipped` — термінальний стан без генерації акту.

### 3.4 Резолв ціни (`FR-TAR-*`)

- **FR-TAR-01:** Існує сутність `Tariff` з полями `apartments_min`, `apartments_max` (NULL = catch-all), `price`, `effective_from`.
- **FR-TAR-02:** Сітка тарифів завжди містить рівно одне catch-all правило (`apartments_max IS NULL`); CRUD блокує видалення останнього catch-all.
- **FR-TAR-03:** Зміна ціни — додати новий рядок з пізнішим `effective_from`, не редагувати існуючий.
- **FR-TAR-04:** Пріоритет резолву: ranged правила перед catch-all → вужчий діапазон перед ширшим → свіжіший `effective_from` перед старішим.
- **FR-TAR-05:** Існує сутність `SmsPrice` з полями `price`, `effective_from` (без діапазону).
- **FR-TAR-06:** `resolve_sms_price(payment_date)` повертає `price` найсвіжішого правила з `effective_from <= payment_date`.
- **FR-TAR-07:** `Client.access_price_override` (nullable) перебиває тарифну сітку повністю для `service_type = access` (не "знижка від базової", а "інша ціна замість").
- **FR-TAR-08:** Override не впливає на ціну СМС.
- **FR-TAR-09:** Резолв ціни приймає (`client`, `service_type`, `payment_date`) і завжди використовує `payment_date` (не дату класифікації). Snapshot ціни у `Act.unit_price` immutable.
- **FR-TAR-10:** Стартова конфігурація: 1 catch-all `Tariff` з `price=200, apartments_min=0, apartments_max=NULL`; 1 `SmsPrice` з `price=1.40, effective_from='2024-01-01'`.

### 3.5 Клієнти (`FR-CLI-*`)

- **FR-CLI-01:** Адмін може створити нового клієнта вручну (`/clients/new`), у тому числі без `moeosbb_user_id` (локальний клієнт).
- **FR-CLI-02:** При створенні клієнта з картки платежу поля `name`, `legal_id`, `bank_account` передзаповнені з `payer_*`.
- **FR-CLI-03:** Поле `apartments_count` — manual-only; не оновлюється sync-ом з "Моє ОСББ".
- **FR-CLI-04:** Поле `auto_act_disabled` — manual-only, default `false`.
- **FR-CLI-05:** Поле `access_price_override` — manual-only, nullable.
- **FR-CLI-06:** Поле `edo_provider` — manual-only enum (`dubidoc` за замовчуванням / `vchasno_external`); зміна цього поля не торкає вже згенеровані акти.
- **FR-CLI-07:** Адмін може прив'язати локального клієнта до "Моє ОСББ", вписавши `moeosbb_user_id` (валідація на unique).
- **FR-CLI-08:** Кнопка "Архівувати" встановлює `auto_act_disabled = true`.
- **FR-CLI-09:** Список клієнтів фільтрується за `auto_act_disabled` (Активні/Архів), `moeosbb_user_id IS NULL` (Локальні/Із "Моє ОСББ"), наявністю договору, `edo_provider`.
- **FR-CLI-10:** Картка клієнта має tabs: Загальна інформація, Договір, Платежі, Акти.
- **FR-CLI-11:** На картці клієнта без договору відображається warning: "Без договору акти не генеруються".

### 3.6 Договори (`FR-CTR-*`)

- **FR-CTR-01:** Кожен клієнт має 0 або 1 договір; договір обов'язковий перед генерацією акту.
- **FR-CTR-02:** Адмін має повний CRUD над договорами (`/contracts`).
- **FR-CTR-03:** Поля договору: `number` (default = `moeosbb_user_id`), `signed_date`, `is_standard`, `file_url` (опц.), `notes`.
- **FR-CTR-04:** Зміна `number`/`signed_date` не торкає `Act.contract_snapshot` уже згенерованих актів; UI показує warning.
- **FR-CTR-05:** Видалення договору з прив'язаними актами блокується (FK `RESTRICT`).
- **FR-CTR-06:** Якщо заповнено `file_url` — UI показує preview (iframe для PDF) або кнопку "Завантажити".

### 3.7 Генерація акту (`FR-ACT-*`)

- **FR-ACT-01:** Тригер автогенерації акту — успішна класифікація платежу для клієнта з `auto_act_disabled = false` І `edo_provider = dubidoc`.
- **FR-ACT-02:** Номер акту: перший за клієнта в місяці M — `№M`; наступні — `№M/N`, де N — порядковий номер у місяці. Нумерація окрема для кожного клієнта.
- **FR-ACT-03:** Генерація номера виконується під `SELECT ... FOR UPDATE` на `acts` по `(client_id, year, month)` + UNIQUE index `(client_id, act_date, number)`.
- **FR-ACT-04:** При генерації акту копіюються snapshot-поля: `client_snapshot` (name, legal_id, address, bank_name, bank_account, email), `contract_snapshot` (number, signed_date), `unit_price`, `quantity`, `quantity_unit`, `edo_provider`.
- **FR-ACT-05:** `service_description` автогенерується за шаблоном залежно від `service_type`: `access` → "Доступ до сервісу за період {quantity} {quantity_unit}"; `sms` → "СМС-розсилка {quantity} {quantity_unit}"; `other` — заповнюється вручну.
- **FR-ACT-06:** Адмін може редагувати `service_description` у статусі `draft`; для `vchasno_external` редагування і регенерація PDF дозволені в будь-якому статусі.
- **FR-ACT-07:** PDF рендериться **локально** через HTML+React+Tailwind → headless Chromium у Vercel Function; зовнішнє API htmldocs.com не використовується.
- **FR-ACT-08:** Згенерований PDF зберігається у Vercel Blob (приватний), посилання — у `Act.pdf_file_url`.
- **FR-ACT-09:** Адмін може перегенерувати PDF з картки акту; для `dubidoc`-актів рекомендовано робити це лише до `sent_to_edo`, для `vchasno_external` — будь-коли.
- **FR-ACT-10:** Для актів `service_type = other` адмін заповнює `unit_price`, `quantity`, `service_description` вручну.

### 3.8 ЕДО — канал Дубідок (`FR-EDO-*`, dubidoc)

- **FR-EDO-01:** Для актів з `edo_provider = dubidoc` після створення викликається `POST /api/v1/documents` Дубідок: `file` (base64 PDF), `filename`, `title`, `date` = `act_date`, `number`, `amount` (int), `signatureType = "external"`, `workflowType = "sequential"`.
- **FR-EDO-02:** У `participants[]` передається один елемент: `{action: "sign", email: <client_snapshot.email>, edrpou: <client_snapshot.legal_id>, priority: 1, isSignatureRequired: true}`.
- **FR-EDO-03:** Окремий sync довідника `/api/v1/contacts` не виконується — Дубідок створює запис автоматично.
- **FR-EDO-04:** При успішному `POST` `Act.status = sent_to_edo`, `Act.edo_doc_id = <id>`.
- **FR-EDO-05:** Cron-задача polling-у Дубідок (інтервал `Settings.dubidoc_poll_interval_hours`, default 6) бере всі `Act` зі `status = sent_to_edo AND edo_provider = dubidoc` і викликає `GET /api/v1/documents/{id}`.
- **FR-EDO-06:** Мапінг відповіді Дубідок → `Act`: `status="signed"` → `Act.status = signed`; `archived=true` → `Act.status = deleted` + `Payment.act_id = NULL`; `refused=true` → `Act.edo_status = "refused"`, `Act.status` лишається `sent_to_edo`; інші — `Act.edo_status = "<raw>"`.
- **FR-EDO-07:** Поле `Act.edo_status` — text (не enum), бо набір значень Дубідок широкий і нестабільний.
- **FR-EDO-08:** Webhook від Дубідок не реєструється (`callbackUrl` не передається). Інтеграція polling-only.
- **FR-EDO-09:** При помилці `POST /documents` (5xx/timeout) — 3 retries з backoff; якщо не виходить, `Act.status` лишається `draft`, у UI акт з індикатором "Не відправлено" і кнопкою "Спробувати ще раз".
- **FR-EDO-10:** Idempotency retry-у: перед повторним `POST` перевіряється `Act.edo_doc_id IS NULL`; якщо є — retry не виконується.
- **FR-EDO-11:** Адмін може запустити `GET /documents/{id}` поза розкладом polling кнопкою "Оновити статус з Дубідок" на картці акту.
- **FR-EDO-12:** У UI відображається посилання на `https://my.dubidoc.com.ua/documents/{edo_doc_id}` для `dubidoc`-актів.

### 3.9 ЕДО — канал Вчасно external (`FR-EDO-*`, vchasno_external)

- **FR-EDO-20:** Для клієнтів з `edo_provider = vchasno_external` платіж попадає у `awaiting_review(external_edo)`; авто-акт не створюється.
- **FR-EDO-21:** Адмін вручну натискає "Згенерувати акт" у черзі; створюється `Act` з `edo_provider = vchasno_external`, `status = draft`, `edo_doc_id = NULL`, `edo_status = NULL`. API Дубідок не викликається.
- **FR-EDO-22:** Адмін викачує PDF, підписує його у Вчасно поза системою, потім натискає "Позначити підписаним" у UI — `Act.status = signed`.
- **FR-EDO-23:** Адмін може скасувати позначку підпису ("Скасувати позначку підпису" → `draft`) для випадків помилки.
- **FR-EDO-24:** Polling статусу Вчасно не виконується (API немає).
- **FR-EDO-25:** Для `vchasno_external` нумерація актів спільна з `dubidoc` (одна серія `№M / №M/N` у межах клієнта в місяці).

### 3.10 Sync з "Моє ОСББ" (`FR-SYNC-*`)

- **FR-SYNC-01:** Sync — read-only `SELECT` з MySQL "Моє ОСББ", оновлює поля `Client`: `name`, `legal_id`, `address`, `bank_name`, `bank_account`, `email`.
- **FR-SYNC-02:** Sync застосовується тільки до клієнтів з `moeosbb_user_id IS NOT NULL`.
- **FR-SYNC-03:** Розклад `Settings.moeosbb_sync_schedule`: `first` (1-го числа місяця, default), `last` (останній день місяця), `manual` (без автомат. sync).
- **FR-SYNC-04:** Кнопка "Синхронізувати зараз" на дашборді й на картці клієнта запускає sync поза розкладом.
- **FR-SYNC-05:** Sync не оновлює `apartments_count`, `access_price_override`, `auto_act_disabled`, `edo_provider`.
- **FR-SYNC-06:** Sync не повідомляє про конкретні дельти — просто оновлює.

### 3.11 Черга розбору (`FR-QUEUE-*`)

- **FR-QUEUE-01:** Маршрут `/queue` має дві вкладки: "На апрув" (`Payment.status = awaiting_review`) і "Проблеми класифікації" (`Payment.status = in_queue`).
- **FR-QUEUE-02:** Кожна вкладка групує платежі за `classification_reason`.
- **FR-QUEUE-03:** Для `no_match` доступні дії "Створити нового клієнта" і "Прив'язати до існуючого" (autocomplete).
- **FR-QUEUE-04:** Для `multiple_contracts` показується radio-select зі знайденими номерами.
- **FR-QUEUE-05:** Для `multiple_clients_same_edrpou` показується попередження «кілька активних клієнтів з цим ЄДРПОУ» і селектор лише активних кандидатів (з номером договору та moeosbb-ID); вибір привʼязує платіж і продовжує класифікацію. Архівовані не показуються. (`ambiguous_client` — застаріла причина, D-041; лишається лише для історичних платежів.)
- **FR-QUEUE-06:** Для `client_incomplete` показується missing-список з посиланнями на конкретні поля клієнта/договору.
- **FR-QUEUE-07:** Для `amount_mismatch` / `sms_quantity_mismatch` показуються можливі варіанти і форма корекції.
- **FR-QUEUE-08:** Для `external_edo` (Вчасно) платіж позначається бейджем "Вчасно" і підказкою про ручний workflow.
- **FR-QUEUE-09:** Після ручної корекції класифікація реруниться автоматично.
- **FR-QUEUE-10:** Дія "Пропустити" встановлює `Payment.status = skipped` (термінальний).

### 3.12 UI — інші розділи (`FR-UI-*`)

- **FR-UI-01:** Дашборд (`/`) показує банери стану інтеграцій (ПриватБанк, Дубідок, "Моє ОСББ") з ✓/✗ і timestamp останньої успішної взаємодії.
- **FR-UI-02:** Дашборд показує лічильники: "Платежів у черзі", "Платежів на апрув", "Актів очікують підпису".
- **FR-UI-03:** Дашборд містить кнопки "Синхронізувати ПриватБанк зараз", "Синхронізувати Моє ОСББ зараз", "Опитати статуси Дубідок".
- **FR-UI-04:** Розділ "Платежі" (`/payments`) має фільтри: status (multi), period, client (autocomplete), service_type, сума (min/max), text search по `purpose`/`payer_name`.
- **FR-UI-05:** Картка платежу показує `raw_data` як collapsible JSON.
- **FR-UI-06:** Розділ "Акти" (`/acts`) має фільтри: status, period (act_date), client, service_type, `edo_provider`, `edo_status` (text search).
- **FR-UI-07:** Картка акту має read-only snapshot panel із підказкою "Збережено на момент генерації".
- **FR-UI-08:** Кнопка "Скачати PDF" доступна на картці акту в будь-якому статусі.

### 3.13 Налаштування (`FR-SET-*`)

- **FR-SET-01:** Розділ `/settings/tariffs` дозволяє CRUD `Tariff` з валідацією перетину діапазонів і наявності catch-all.
- **FR-SET-02:** Розділ `/settings/sms-prices` дозволяє CRUD `SmsPrice`; майбутні ціни редагуються, історичні (на які є акти) — read-only.
- **FR-SET-03:** Розділ `/settings/patterns` дозволяє CRUD regex-патернів у `Settings.contract_regex_patterns`; кожен патерн має опц. опис і test-area для перевірки на прикладах.
- **FR-SET-04:** Адмін редагує `sms_keywords` як простий список (add/remove).
- **FR-SET-05:** Адмін редагує `transit_edrpou_list` як простий список (стартово `["14360570"]`).
- **FR-SET-06:** Адмін редагує `privatbank_polling_interval_minutes`, `dubidoc_poll_interval_hours`, `moeosbb_sync_schedule`.
- **FR-SET-07:** Поля з credentials (`PRIVATBANK_TOKEN`, `DUBIDOC_TOKEN`, `MOEOSBB_DB_URL`) НЕ відображаються в UI; показується тільки read-only статус підключення.

### 3.14 Обробка edge cases (`FR-EDGE-*`)

- **FR-EDGE-01:** При видаленні/архівації акту в Дубідок (`archived = true` у відповіді polling) — `Act.status = deleted`, `Payment.act_id = NULL`, платіж знову з'являється у списку доступних для класифікації.
- **FR-EDGE-02:** При зміні реквізитів клієнта після генерації акту — історичні `Act.client_snapshot` лишаються незмінними; перевипуск акту — окрема ручна дія (`8.6` → "Перевипустити акт").
- **FR-EDGE-03:** При зміні ціни в період відкладеного платежу `resolve_unit_price` бере ціну на `payment_date`, не дату класифікації.

---

## 4. Нефункціональні вимоги (NFR-\*)

### 4.1 Performance (`NFR-PERF-*`)

- **NFR-PERF-01:** Час від polling-події ПриватБанку до запису `Payment` у БД — `< 5 с`.
- **NFR-PERF-02:** Класифікація одного платежу (happy path → акт у БД) — `< 2 с`.
- **NFR-PERF-03:** Рендер PDF одного акту: `< 8 с` (cold start Chromium на Vercel), `< 2 с` (warm).
- **NFR-PERF-04:** Відправка акту в Дубідок (`POST /documents`) — `< 3 с` round-trip.
- **NFR-PERF-05:** End-to-end від polling-події до акту в Дубідок — `< 60 с` у happy path.
- **NFR-PERF-06:** Polling статусу Дубідок (`GET /documents/{id}` поштучно) — `< 1 с` на запит.
- **NFR-PERF-07:** Адмін-сторінка (Server Components) — `< 1.5 с` first contentful paint.
- **NFR-PERF-08:** SLA polling-у не є строгим — overlapping period забезпечує eventual consistency.

### 4.2 Безпека (`NFR-SEC-*`)

- **NFR-SEC-01:** Усі credentials і ключі зберігаються лише в env, ніколи в БД, ніколи в коді. Управління через `vercel env` (preview / development / production окремо).
- **NFR-SEC-02:** Обов'язкові env-змінні: `PRIVATBANK_TOKEN`, `FOP_BANK_ACCOUNT` (рахунок ФОПа, з якого PrivatBank API тягне виписку — параметр `acc`; **не** плутати з друкованим IBAN у реквізитах акту `fop_requisites.bankAccount`), `DUBIDOC_TOKEN`, `MOEOSBB_DB_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH`, `SESSION_SECRET`. Auto-provisioned: `POSTGRES_URL`, `BLOB_READ_WRITE_TOKEN`.
- **NFR-SEC-03:** Пароль зберігається тільки як argon2id хеш.
- **NFR-SEC-04:** TLS обов'язковий у production (auto-провіжен Vercel).
- **NFR-SEC-05:** MySQL "Моє ОСББ" доступний з окремим read-only користувачем (`GRANT SELECT` only).
- **NFR-SEC-06:** В логах поля з ключами `*token*`, `*password*`, `*secret*`, `*url*` redacted.
- **NFR-SEC-07:** Жодних webhook endpoint-ів у MVP — зменшення поверхні атаки.
- **NFR-SEC-08:** ON DELETE RESTRICT на `Client`/`Contract`/`Payment`/`Act` — БД-рівнева гарантія від втрати юридичних документів.

### 4.3 Логування і моніторинг (`NFR-LOG-*`)

- **NFR-LOG-01:** Усі логи — **structured JSON у stdout** (pino або еквівалент); Vercel автоматично збирає в Vercel Logs.
- **NFR-LOG-02:** Поля log-event-а: `timestamp`, `level`, `event` (machine-readable), `payment_id`/`client_id`/`act_id` (де релевантно), `details`.
- **NFR-LOG-03:** Обов'язково логуються: усі state-transitions `Payment.status` і `Act.status`; усі виклики зовнішніх API (timestamp, endpoint, status, latency); cron-задачі (start/end/counts); login-події (success/failure, IP, email).
- **NFR-LOG-04:** Тіло запиту/відповіді зовнішніх API логується тільки на `level=debug` за прапором `DEBUG_API=true`.
- **NFR-LOG-05:** Не логуються health-check pings.
- **NFR-LOG-06:** Алерти про збої — тільки банер на дашборді (без push-каналів у MVP); ad-hoc-таблиця `integration_health` з полями `last_success_at`, `last_error_at`, `last_error_code`, `last_error_message` на кожний зовнішній сервіс.

### 4.4 Доступність і резервне копіювання (`NFR-AVAIL-*`)

- **NFR-AVAIL-01:** Production deploy через push у `main` (Vercel GitHub Integration); preview deploy на pull request.
- **NFR-AVAIL-02:** Rollback — через Vercel UI ("Promote to Production" попередньої версії).
- **NFR-AVAIL-03:** Neon Postgres з увімкненим PITR (point-in-time recovery, ≥ 7 днів).
- **NFR-AVAIL-04:** Phase 1: щотижневий `pg_dump` → Vercel Blob (encrypted).
- **NFR-AVAIL-05:** PDF файли у Vercel Blob backup не потребують — регенерувальні зі snapshot-полів акту.
- **NFR-AVAIL-06:** Health endpoint `/api/health` повертає 200 + JSON зі статусом БД, Vercel Blob, останнього sync.

### 4.5 Масштабованість (`NFR-SCALE-*`)

- **NFR-SCALE-01:** Цільовий профіль: ~300 клієнтів, ~500 платежів/місяць, ~500-600 актів/місяць.
- **NFR-SCALE-02:** Sync "Моє ОСББ" — ~300 рядків раз/місяць.
- **NFR-SCALE-03:** Жодних оптимізацій під більший масштаб у MVP не передбачено. Оптимізація — лише при фактичному зростанні до ~3000 клієнтів.

---

## 5. Технічні обмеження (TC-\*)

### 5.1 Стек (`TC-STACK-*`)

- **TC-STACK-01:** Next.js (App Router), TypeScript strict; Server Components за замовчуванням, `'use client'` тільки де потрібна інтерактивність.
- **TC-STACK-02:** Node.js 24 LTS (поточна LTS на дату запуску).
- **TC-STACK-03:** Tailwind CSS + shadcn/ui (компоненти копіюються в проект, не npm-залежність).
- **TC-STACK-04:** UI-стек для PDF: HTML + React + Tailwind, рендер через headless Chromium (`@sparticuz/chromium`) у Vercel Function.
- **TC-STACK-05:** Авторизація — email/password (argon2id), session у Postgres + HTTP-only cookie. Без NextAuth/Clerk у MVP.
- **TC-STACK-06:** Конфігурація проекту — `vercel.ts` (TypeScript), не `vercel.json`.
- **TC-STACK-07:** В Next.js 16 використовується `proxy.ts` замість `middleware.ts` (за поточними conventions Next.js).

### 5.2 Хостинг (`TC-HOST-*`)

- **TC-HOST-01:** Хостинг — **Vercel** (Fluid Compute, повний Node.js runtime). Edge Functions не використовуються (compatibility issues з Chromium і Node-only бібліотеками).
- **TC-HOST-02:** Cron-задачі — Vercel Cron Jobs, оголошені в `vercel.ts`. Стартові розклади: ПриватБанк polling `0 * * * *`, Дубідок polling `0 */6 * * *`, "Моє ОСББ" sync `0 0 * * *` (всередині handler-а перевіряється `Settings.moeosbb_sync_schedule` і дата).
- **TC-HOST-03:** Auto-deploy через Vercel GitHub Integration; manual rollback через Vercel UI. Production deploy НЕ блокується failing GitHub Actions у MVP.
- **TC-HOST-04:** Branching — trunk-based на `main`; feature branches тільки для preview deploy і review.
- **TC-HOST-05:** Жодних секретів у GitHub repo або GitHub Actions secrets (крім тестових fixtures).

### 5.3 База даних і storage (`TC-DB-*`)

- **TC-DB-01:** Основна БД — **PostgreSQL через Neon** (Vercel Marketplace), `POSTGRES_URL` auto-provisioned.
- **TC-DB-02:** Локальна БД відокремлена від БД "Моє ОСББ" (різний інстанс).
- **TC-DB-03:** Storage PDF — **Vercel Blob** (приватний), `BLOB_READ_WRITE_TOKEN` auto-provisioned.
- **TC-DB-04:** ORM/міграції — drizzle / prisma / kysely (вибір фіксується при першій реалізації).
- **TC-DB-05:** Vercel Postgres і Vercel KV не використовуються (продукти сунесені — використовується Marketplace).
- **TC-DB-06:** ON DELETE поведінка: `Contract.client_id`, `Payment.client_id`, `Act.client_id`, `Act.payment_id` → `RESTRICT`; `Payment.act_id` → `SET NULL`.
- **TC-DB-07:** UNIQUE constraints: `Payment.bank_transaction_id`; `(Act.client_id, Act.act_date, Act.number)`.

### 5.4 Інтеграції (`TC-INTEG-*`)

- **TC-INTEG-01:** ПриватБанк Автоклієнт API — read-only HTTP-клієнт; реюз коду з `~/Projects/privatbank-telegram-bot`.
- **TC-INTEG-02:** Дубідок API — Premium-план (обов'язковий для полів `date`, `number`, `amount`, `participants[]`); реюз HTTP-клієнта з `~/Projects/zbory_v2` (без webhook-логіки).
- **TC-INTEG-03:** MySQL "Моє ОСББ" — read-only `SELECT` з таблиці `osbb_users`; connection через `MOEOSBB_DB_URL`. Мережевий доступ до приватного MySQL з Vercel — TBD (IP whitelist через Vercel Pro предсказуваний egress / окремий sync-gateway / реюз patterns).
- **TC-INTEG-04:** Вчасно — без API-інтеграції; тільки ручний канал (`vchasno_external`).
- **TC-INTEG-05:** PDF генерується локально; хмарне htmldocs.com API НЕ використовується (PII не виходить за периметр).
- **TC-INTEG-06:** Семантика домену: enum `Client.edo_provider` має значення `dubidoc` (default) і `vchasno_external`. Розширення (інші EDO) — за рішенням у Phase 3+.

### 5.5 Конкурентність та idempotency (`TC-INTEG-*` cont.)

- **TC-INTEG-10:** Polling ПриватБанку гарантує idempotency через UNIQUE `bank_transaction_id` + `ON CONFLICT DO NOTHING`.
- **TC-INTEG-11:** Класифікація обгорнута в Postgres-транзакцію з `SELECT ... FOR UPDATE` на `Payment`; параллельні запуски однієї транзакції чекають.
- **TC-INTEG-12:** Генерація номера акту — `FOR UPDATE` на acts по `(client_id, year, month)` + UNIQUE index як двошаровий захист.
- **TC-INTEG-13:** Retry відправки в Дубідок захищений перевіркою `Act.edo_doc_id IS NULL` (якщо є — retry не виконується).

---

## 6. Дорожня карта (короткий зміст)

### Phase 0 — MVP (end-to-end happy path + черга розбору)

Покриває всі вимоги з префіксом `FR-*`, `NFR-PERF-01..07`, `NFR-SEC-*`, `NFR-LOG-*` (без push-каналів), `NFR-AVAIL-01..03,06`, усі `TC-*`. Phase 0 завершується станом, у якому система виставляє реальні акти на реальних платежах.

### Phase 1 — UX та edge cases

- Затягнення polling Дубідок до 6 годин або 1 години (за фактичними потребами).
- Аналітика на дашборді (% автокласифікованих, середній час до акту, частота reasons).
- Bulk-операції на платежах (`Класифікувати всі однотипні з reason=X`).
- Inline-редагування полів клієнта в черзі.
- Експорт списків у CSV/Excel.
- Visual test regex patterns на реальних прикладах.
- Перевипуск акту як explicit flow.
- `NFR-AVAIL-04` (щотижневий `pg_dump`).

### Phase 2 — push-канали, оптимізації

- Push-алерти (Telegram bot / email).
- Webhook від Дубідок.
- Fuzzy-матч по ПІБ для транзитних рахунків.
- 2FA на login.
- `OverrideHistory` для версіонування `Client.access_price_override`.
- Аудит-лог дій адміна.

### Phase 3+ (за фактичною потребою)

- Повноцінна API-інтеграція з Вчасно.
- Інтеграція з третім EDO-провайдером.
- Multi-admin.
- Розширена аналітика.

---

## 7. Глосарій (короткий)

| Термін         | Розшифровка                                                |
| -------------- | ---------------------------------------------------------- |
| **ФОП**        | Фізична Особа-Підприємець (Україна)                        |
| **ЄП 3 група** | Третя група єдиного податку (5% від доходу, без ПДВ)       |
| **ОСББ / ЖБК** | Об'єднання співвласників / Житлово-будівельний кооператив  |
| **ЄДРПОУ**     | 8-значний ідентифікатор юр. особи                          |
| **РНОКПП**     | 10-значний податковий номер фіз. особи / ФОПа              |
| **IBAN**       | Український формат `UA` + 27 символів                      |
| **"Моє ОСББ"** | SaaS-продукт автора (інтегрується read-only)               |
| **Дубідок**    | EDO-провайдер (dubidoc.com.ua), API-канал                  |
| **Вчасно**     | EDO-провайдер (vchasno.ua), ручний канал без API           |
| **EDO**        | Electronic Document Operator (абстракція над провайдерами) |
| **snapshot**   | Immutable копія значень на момент створення акту           |
| **PITR**       | Point-in-Time Recovery (Neon Postgres)                     |

Повний глосарій і приклади даних — у [`prd-rationale.md § 12`](prd-rationale.md).

---

## 8. Посилання

- Вихідний skeleton (повна версія з обґрунтуваннями): [`prd-rationale.md`](prd-rationale.md)
- Доменна модель: [`domain-model.md`](domain-model.md)
- Лог рішень: [`adr/`](adr/README.md) (D-001…D-036; один файл на рішення)
- Аналіз банківської виписки: [`research/payments-analysis.md`](research/payments-analysis.md)
- Зразки актів: [`samples/acts/`](samples/acts/)
- ПриватБанк Автоклієнт API: [`api-docs/Privatbank_API.pdf`](api-docs/Privatbank_API.pdf)
- Дубідок API: [`api-docs/dubidoc.json`](api-docs/dubidoc.json)

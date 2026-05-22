# Domain Model

**Версія:** 0.10.0
**Статус:** актуальна на дату підготовки PRD skeleton
**Призначення:** довідник з поточної моделі домену. Звертатися до цього файлу за актуальним станом сутностей, правил та логіки. Оновлювати після кожного чату, в якому приймаються рішення про модель.

**Двигун БД:** PostgreSQL (D-024). Типи нижче — у нотації PostgreSQL.

---

## Огляд процесу

```
ПриватБанк (polling 1 раз/год)
   ↓
Payment (вхідний платіж)
   ↓
Класифікація: клієнт + тип послуги + ціна + кількість
   ↓
   ├─→ Identified, auto_act_disabled=false, edo_provider=dubidoc → Act (генерується одразу)
   ├─→ Identified, auto_act_disabled=true → manual_review_queue (ручна обробка)
   ├─→ Identified, edo_provider=vchasno_external → manual_review_queue (зовнішнє ЕДО)
   └─→ Unidentified / ambiguous / amount_mismatch → manual_review_queue
                                                          ↓
                                              Адмін розбирає вручну
                                                          ↓
                                                    Act (або skip)
   ↓
   ├─ edo_provider=dubidoc:
   │     Act → Дубідок (створення документа)
   │       ↓
   │     Адмін підписує електронним підписом у Дубідок (ручна дія)
   │       ↓
   │     Дубідок автоматично надсилає підписаний акт на email клієнта
   │
   └─ edo_provider=vchasno_external:
         Act → локальний PDF (без виклику API)
           ↓
         Адмін викачує PDF, завантажує у Вчасно, підписує
           ↓
         Адмін у адмінці натискає "Позначити підписаним" → Act.status = signed
```

---

## Сутності

### Client

Контрагент-отримувач послуги (зазвичай ОСББ, ЖБК, ТОВ або ФОП-управитель).

| Поле                       | Тип                                      | Origin          | Опис                                                                                                                                     |
| -------------------------- | ---------------------------------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                       | `uuid`                                   | auto            | Первинний ключ                                                                                                                           |
| `moeosbb_user_id`          | `bigint`, nullable, UNIQUE               | sync/manual     | ID клієнта в БД "Моє ОСББ". Якщо NULL — клієнт локальний, не синхронізується                                                             |
| `name`                     | `text`                                   | sync/manual     | Повна назва контрагента                                                                                                                  |
| `legal_id`                 | `text`                                   | sync/manual     | ЄДРПОУ (8 цифр) або РНОКПП (10 цифр)                                                                                                     |
| `address`                  | `text`                                   | sync/manual     | Юридична адреса                                                                                                                          |
| `bank_name`                | `text`, nullable                         | sync/manual     | Назва банку клієнта                                                                                                                      |
| `bank_account`             | `text`, nullable                         | sync/manual     | IBAN клієнта                                                                                                                             |
| `email`                    | `text`                                   | sync/manual     | Email для отримання підписаного акту з Дубідок                                                                                           |
| `apartments_count`         | `integer`, nullable                      | **manual only** | Кількість квартир. Заповнюється вручну в адмінці. Базис для тарифу                                                                       |
| `access_price_override`    | `numeric(10,2)`, nullable                | manual          | Індивідуальна ціна доступу. Якщо задано — перебиває тарифну сітку                                                                        |
| `auto_act_disabled`        | `boolean`, default `false`               | manual          | Якщо true — акти не генеруються автоматично, платежі попадають у чергу для ручної обробки. Також служить ознакою архіву (UI 8.4) — D-025 |
| `edo_provider`             | `edo_provider` (ENUM), default `dubidoc` | manual          | Канал оформлення акту: `dubidoc` (через API) або `vchasno_external` (PDF локально, підпис у Вчасно поза системою). Див. D-036            |
| `last_sync_at`             | `timestamptz`, nullable                  | system          | Дата останнього sync з "Моє ОСББ" (NULL для повністю локальних)                                                                          |
| `created_at`, `updated_at` | `timestamptz`                            | system          |                                                                                                                                          |

**Origin legend:**

- `sync` — заповнюється/оновлюється з MySQL "Моє ОСББ"
- `manual` — редагується вручну в адмінці
- `manual only` — заповнюється ТІЛЬКИ вручну, sync не торкається
- `system` — заповнюється автоматично системою

**Правила синхронізації з "Моє ОСББ":**

- Sync працює ТІЛЬКИ для клієнтів з `moeosbb_user_id IS NOT NULL`
- Поля, що оновлюються при sync: `name`, `legal_id`, `address`, `bank_name`, `bank_account`, `email`
- `apartments_count`, `access_price_override`, `auto_act_disabled`, `edo_provider` НІКОЛИ не перезаписуються sync-ом

---

### Contract

Договір з клієнтом. Cardinality з клієнтом: **1 : 0..1** (один клієнт має максимум один договір; може існувати без договору тимчасово). Без договору генерація акту блокується — крок 5 класифікації повертає `client_incomplete` з `missing=["contract"]`. Див. D-019.

| Поле                       | Тип                                                 | Опис                                                                                                    |
| -------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `id`                       | `uuid`                                              | Первинний ключ                                                                                          |
| `number`                   | `text`                                              | Номер договору. Стандартно дорівнює `moeosbb_user_id`, але може бути нестандартний (WB-4, 011220, тощо) |
| `client_id`                | `uuid`, FK → Client, **ON DELETE RESTRICT** (D-025) | Власник договору                                                                                        |
| `signed_date`              | `date`                                              | Дата підписання договору                                                                                |
| `is_standard`              | `boolean`                                           | Чи стандартна форма договору                                                                            |
| `file_url`                 | `text`, nullable                                    | Посилання на файл договору                                                                              |
| `edo_doc_id`               | `text`, nullable                                    | ID документа в EDO (Дубідок) — для трекінгу                                                             |
| `notes`                    | `text`, nullable                                    | Нотатки для нестандартних договорів                                                                     |
| `created_at`, `updated_at` | `timestamptz`                                       |                                                                                                         |

---

### Payment

Вхідний платіж із ПриватБанку. Сира + обчислена інформація.

| Поле                     | Тип                                                           | Опис                                                                  |
| ------------------------ | ------------------------------------------------------------- | --------------------------------------------------------------------- |
| `id`                     | `uuid`                                                        | Первинний ключ                                                        |
| `bank_transaction_id`    | `text`, UNIQUE                                                | ID транзакції з ПриватБанку. Idempotency-ключ                         |
| `payment_date`           | `date`                                                        | Дата платежу                                                          |
| `amount`                 | `numeric(12,2)`                                               | Сума                                                                  |
| `purpose`                | `text`                                                        | Призначення платежу (raw)                                             |
| `payer_name`             | `text`                                                        | Назва платника                                                        |
| `payer_legal_id`         | `text`                                                        | ЄДРПОУ/РНОКПП платника                                                |
| `payer_bank_account`     | `text`, nullable                                              | IBAN платника                                                         |
| `raw_data`               | `jsonb`                                                       | Сирий payload із ПриватБанку (для аудиту)                             |
| `status`                 | `payment_status` (ENUM)                                       | див. нижче                                                            |
| `client_id`              | `uuid`, FK → Client, nullable, **ON DELETE RESTRICT** (D-025) | Зматчений клієнт (NULL якщо не зматчено)                              |
| `service_type`           | `service_type` (ENUM), nullable                               | access / sms / other (див. D-016)                                     |
| `unit_price`             | `numeric(10,2)`, nullable                                     | Ціна за одиницю на момент класифікації                                |
| `quantity`               | `integer`, nullable                                           | Кількість одиниць (місяців для access, шт для sms)                    |
| `parsed_contract_number` | `text`, nullable                                              | Номер договору, витягнений з призначення                              |
| `classification_reason`  | `classification_reason` (ENUM), nullable                      | Причина статусу (див. нижче)                                          |
| `classified_at`          | `timestamptz`, nullable                                       | Час класифікації                                                      |
| `classified_by`          | `classified_by` (ENUM: `auto` / `manual`)                     |                                                                       |
| `act_id`                 | `uuid`, FK → Act, nullable, **ON DELETE SET NULL** (D-025)    | Згенерований акт (NULL якщо ще не згенеровано або акт видалено в EDO) |
| `created_at`             | `timestamptz`                                                 |                                                                       |

**Payment.status enum:**

- `received` — щойно отримано з ПриватБанку, ще не класифіковано
- `classified` — успішно класифіковано, акт згенеровано
- `awaiting_review` — клієнт ідентифікований, але авто-генерація акту заблокована бізнес-правилом. Потрібен ручний апрув перед генерацією акту
- `in_queue` — автокласифікація неможлива через проблему з даними. Потрібне ручне втручання для з'ясування ситуації
- `skipped` — пропущено вручну (акт не потрібен). Термінальний стан

**Payment.classification_reason enum:**

Для `awaiting_review`:

- `auto_act_disabled` — клієнт у списку виключень (наприклад, нестандартний договір — Урбан, Авалон тощо)
- `external_edo` — клієнт має `edo_provider = vchasno_external`, автогенерація через Дубідок не виконується (D-036)

Для `in_queue`:

- `no_match` — клієнт не зматчений
- `multiple_contracts` — в призначенні знайдено >1 різних номерів договору після dedup (D-027). Адмін обирає правильний у UI
- `ambiguous_client` — номер договору вказує на клієнта X, але ЄДРПОУ платника не збігається
- `amount_mismatch` — сума не ділиться націло на ціну послуги
- `sms_quantity_mismatch` — для СМС: розрахункова quantity не сходиться з amount
- `unknown_service_type` — не вдалось визначити тип послуги
- `client_incomplete` — клієнт зматчений, але не заповнено обов'язкові поля (email, apartments_count тощо)

Див. D-014 в `adr/` щодо розподілу reasons між awaiting_review і in_queue.

---

### Act

Акт виконаних робіт. Один платіж = один акт.

| Поле                       | Тип                                                  | Опис                                                                                                                                                                                         |
| -------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                       | `uuid`                                               | Первинний ключ                                                                                                                                                                               |
| `number`                   | `text`                                               | Номер акту у форматі `№M` або `№M/N`                                                                                                                                                         |
| `act_date`                 | `date`                                               | Дата акту = останній день місяця платежу                                                                                                                                                     |
| `payment_id`               | `uuid`, FK → Payment, **ON DELETE RESTRICT** (D-025) | Платіж-джерело                                                                                                                                                                               |
| `client_id`                | `uuid`, FK → Client, **ON DELETE RESTRICT** (D-025)  | Клієнт                                                                                                                                                                                       |
| `service_type`             | `service_type` (ENUM)                                | access / sms / other (див. D-016)                                                                                                                                                            |
| `service_description`      | `text`                                               | Human-readable опис послуги для рендеру в PDF. Для access/sms — автогенерується з шаблону; для other — заповнюється вручну. Може редагуватись адміном перед відправкою в EDO                 |
| `unit_price`               | `numeric(10,2)`                                      | **Snapshot** ціни на момент генерації                                                                                                                                                        |
| `quantity`                 | `integer`                                            | Кількість одиниць                                                                                                                                                                            |
| `quantity_unit`            | `text`                                               | "міс." / "шт." (для рендеру в PDF)                                                                                                                                                           |
| `total_amount`             | `numeric(12,2)`                                      | unit_price × quantity (має дорівнювати payment.amount)                                                                                                                                       |
| `client_snapshot`          | `jsonb`                                              | **Snapshot** реквізитів клієнта на момент генерації                                                                                                                                          |
| `contract_snapshot`        | `jsonb`                                              | **Snapshot** номера і дати договору на момент генерації (D-019)                                                                                                                              |
| `status`                   | `act_status` (ENUM)                                  | див. нижче                                                                                                                                                                                   |
| `edo_provider`             | `edo_provider` (ENUM)                                | **Snapshot** каналу ЕДО на момент створення (`dubidoc` або `vchasno_external`). Копіюється з `client.edo_provider`. Див. D-036                                                               |
| `edo_doc_id`               | `text`, nullable                                     | ID документа в EDO (Дубідок). Для `edo_provider=vchasno_external` завжди NULL                                                                                                                |
| `edo_status`               | `text`, nullable                                     | Останній raw-статус у EDO (Дубідок), збережений при polling-у. Не типізований ENUM, бо Дубідок-набір занадто широкий і нестабільний (D-029). Для `edo_provider=vchasno_external` завжди NULL |
| `pdf_file_url`             | `text`, nullable                                     | Згенерований PDF                                                                                                                                                                             |
| `created_at`, `updated_at` | `timestamptz`                                        |                                                                                                                                                                                              |

**Act.status enum:**

- `draft` — створено локально, ще не відправлено в Дубідок (для `vchasno_external` — створено локально, PDF згенеровано, але адмін ще не підписав у Вчасно)
- `sent_to_edo` — відправлено в EDO (Дубідок). Не застосовно для `edo_provider=vchasno_external`
- `signed` — підписано. Для `dubidoc` — інфа з polling-а Дубідок; для `vchasno_external` — адмін явно натиснув "Позначити підписаним" (D-036)
- `deleted` — видалено в Дубідок. Не застосовно для `edo_provider=vchasno_external`

**Snapshot-поля (`unit_price`, `quantity`, `client_snapshot`, `contract_snapshot`, `edo_provider`):**

- Копіюються в момент генерації акту
- Не оновлюються при подальших змінах клієнта, договору чи тарифу
- Гарантують, що історичні акти лишаються незмінними

**client_snapshot JSON структура:**

```json
{
  "name": "ОСББ \"Приклад\"",
  "legal_id": "12345678",
  "address": "вул. Прикладна, 1, м. Київ",
  "bank_name": "АТ КБ \"ПриватБанк\"",
  "bank_account": "UA...",
  "email": "client@example.com"
}
```

**contract_snapshot JSON структура:**

```json
{
  "number": "557259",
  "signed_date": "2024-07-01"
}
```

---

### Tariff

Правило тарифної сітки.

| Поле             | Тип                 | Опис                                                 |
| ---------------- | ------------------- | ---------------------------------------------------- |
| `id`             | `uuid`              | Первинний ключ                                       |
| `apartments_min` | `integer`           | Нижня межа (включно)                                 |
| `apartments_max` | `integer`, nullable | Верхня межа (включно). NULL = "і більше" (catch-all) |
| `price`          | `numeric(10,2)`     | Ціна за місяць доступу                               |
| `effective_from` | `date`              | Дата початку дії правила                             |
| `created_at`     | `timestamptz`       |                                                      |

**Інваріант сітки (D-018):** тарифна сітка завжди містить рівно одне catch-all правило з `apartments_max IS NULL`. Валідація виконується при CRUD у адмінці.

**Стартова конфігурація:** одне catch-all правило `apartments_min=0, apartments_max=NULL, price=200`.

---

### SmsPrice

Історія цін на 1 СМС. Симетрично до `Tariff` — D-026.

| Поле             | Тип             | Опис                      |
| ---------------- | --------------- | ------------------------- |
| `id`             | `uuid`          | Первинний ключ            |
| `price`          | `numeric(10,2)` | Ціна за 1 СМС на дату дії |
| `effective_from` | `date`          | Дата початку дії правила  |
| `created_at`     | `timestamptz`   |                           |

**Стартова конфігурація:** один рядок `{effective_from='2024-01-01', price=1.40}`.

**Резолв ціни:**

```
resolve_sms_price(payment_date):
    SELECT price FROM sms_prices
    WHERE effective_from <= payment_date
    ORDER BY effective_from DESC
    LIMIT 1
```

Інваріант: таблиця завжди містить принаймні один рядок з `effective_from <= MIN(payment_date в системі)`. Контроль на рівні CRUD адмінки.

---

### PostgreSQL ENUM types (D-024)

Глобально визначені PostgreSQL ENUM, на які посилаються поля сутностей вище:

```sql
CREATE TYPE payment_status AS ENUM ('received', 'classified', 'awaiting_review', 'in_queue', 'skipped');
CREATE TYPE act_status AS ENUM ('draft', 'sent_to_edo', 'signed', 'deleted');
CREATE TYPE service_type AS ENUM ('access', 'sms', 'other');
CREATE TYPE classification_reason AS ENUM (
    'auto_act_disabled',         -- awaiting_review
    'external_edo',              -- awaiting_review (D-036)
    'no_match',                  -- in_queue
    'multiple_contracts',        -- in_queue (D-027)
    'ambiguous_client',          -- in_queue
    'amount_mismatch',           -- in_queue
    'sms_quantity_mismatch',     -- in_queue
    'unknown_service_type',      -- in_queue
    'client_incomplete'          -- in_queue
);
CREATE TYPE classified_by AS ENUM ('auto', 'manual');
CREATE TYPE edo_provider AS ENUM ('dubidoc', 'vchasno_external');  -- D-036
-- edo_status НЕ ENUM: зберігаємо raw-значення Дубідок як text (D-029)
CREATE TYPE moeosbb_sync_schedule AS ENUM ('first', 'last', 'manual');
```

### FK поведінка (ON DELETE) — D-025

| FK                               | ON DELETE  |
| -------------------------------- | ---------- |
| `Contract.client_id → Client.id` | `RESTRICT` |
| `Payment.client_id → Client.id`  | `RESTRICT` |
| `Payment.act_id → Act.id`        | `SET NULL` |
| `Act.client_id → Client.id`      | `RESTRICT` |
| `Act.payment_id → Payment.id`    | `RESTRICT` |

Видалення Client/Contract з історичними платежами/актами заблоковано на рівні БД. "Архівування" клієнта здійснюється через `auto_act_disabled = true` + UI-фільтр (PRD 8.4).

---

### Settings (key-value)

Глобальні налаштування системи.

| Ключ                                  | Значення (приклад)             | Опис                                                                                                                                                   |
| ------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `sms_min_quantity`                    | 100                            | Мінімальне замовлення СМС                                                                                                                              |
| `privatbank_polling_interval_minutes` | 60                             | Інтервал polling ПриватБанк Автоклієнт API (D-029)                                                                                                     |
| `dubidoc_poll_interval_hours`         | 6                              | Інтервал polling статусу актів у Дубідок (D-029)                                                                                                       |
| `moeosbb_sync_schedule`               | "first"                        | Розклад автосинхронізації з БД "Моє ОСББ": `first` (1-го числа) / `last` (останній день) / `manual` (тільки за кнопкою). Default — `first`. Див. D-023 |
| `transit_edrpou_list`                 | ["14360570"]                   | ЄДРПОУ транзитних рахунків банків                                                                                                                      |
| `contract_regex_patterns`             | [...]                          | Список regex-патернів для парсингу номера договору                                                                                                     |
| `sms_keywords`                        | ["смс", "sms", "повідомлення"] | Ключові слова для класифікації СМС                                                                                                                     |

**Що було видалено:** ключі `sms_unit_price` і `sms_unit_price_effective_from` — їх роль перебирає окрема сутність `SmsPrice` (D-026).

**Credentials зберігаються в env, не в Settings (D-020):**

- `PRIVATBANK_TOKEN` — токен ПриватБанк Автоклієнт API
- `DUBIDOC_TOKEN` — токен Дубідок API
- `MOEOSBB_DB_URL` — connection string до MySQL "Моє ОСББ" у форматі `mysql://user:pass@host:port/dbname`

UI Settings (PRD 8.7) НЕ показує і НЕ редагує токени. Натомість показує read-only статус підключення до кожного сервісу.

---

## State Machines

### Payment lifecycle

```
[ПриватБанк polling]
        ↓
   received
        ↓
   [класифікація]
        ↓
   ┌────────┼────────────┐
   ↓        ↓            ↓
classified  awaiting_review  in_queue
                ↓            ↓
          [ручний апрув]  [ручний розбір]
                ↓            ↓
            ┌───┴───┐    ┌───┴───┐
            ↓       ↓    ↓       ↓
        classified skipped classified skipped
```

**Переходи:**

- `received → classified`: автокласифікація успішна, акт згенеровано
- `received → awaiting_review`: клієнт ідентифікований, але бізнес-правило блокує авто-акт (`auto_act_disabled` або `external_edo`)
- `received → in_queue`: автокласифікація неможлива через проблему з даними
- `awaiting_review → classified`: адмін підтвердив/відредагував параметри, акт згенеровано
- `awaiting_review → skipped`: адмін позначив платіж як такий, що не потребує акту
- `in_queue → classified`: адмін розібрався з даними, акт згенеровано
- `in_queue → skipped`: адмін позначив платіж як такий, що не потребує акту

### Act lifecycle

Гілки залежно від `Act.edo_provider` (D-036):

**`edo_provider = dubidoc`:**

```
draft → sent_to_edo → signed
                       ↘ deleted (видалено в Дубідок)
```

- `draft → sent_to_edo`: API-виклик у Дубідок успішний.
- `sent_to_edo → signed`: polling Дубідок повернув статус "signed".
- `sent_to_edo → deleted`: polling Дубідок повернув "deleted".

**`edo_provider = vchasno_external`:**

```
draft → signed
```

- `draft`: акт створено локально, PDF згенеровано, адмін викачує і завантажує у Вчасно.
- `draft → signed`: адмін явно натиснув "Позначити підписаним" після підпису у Вчасно. Переходи `sent_to_edo` та `deleted` не застосовні (API-виклику немає).
- PDF можна перегенерувати в будь-якому статусі, включно з `signed` (канонічна версія живе у Вчасно, локальний PDF — копія).

---

## Логіка класифікації платежу

Покрокова логіка (псевдокод):

```
1. ПАРСИНГ НОМЕРА ДОГОВОРУ
   parsed_contract_numbers = []
   for pattern in settings.contract_regex_patterns:
       matches = apply_pattern(payment.purpose)
       parsed_contract_numbers.extend(matches)
   parsed_contract_numbers = unique(parsed_contract_numbers)   # D-027: dedup

   IF len(parsed_contract_numbers) > 1:                         # D-027
       return in_queue(reason=multiple_contracts)
       # Адмін обирає номер у UI 8.3 і реруниться класифікація.

2. МАТЧИНГ КЛІЄНТА
   contract_number = parsed_contract_numbers[0] IF parsed_contract_numbers ELSE NULL

   IF payer_legal_id IN settings.transit_edrpou_list:
       # Транзитний рахунок — fallback по ЄДРПОУ не працює
       IF contract_number:
           candidate_client = lookup_by_contract_number(contract_number)
           IF candidate_client:
               client = candidate_client  # ЄДРПОУ не перевіряємо для транзиту
           ELSE:
               return in_queue(reason=no_match)
       ELSE:
           return in_queue(reason=no_match)
   ELSE:
       # Нормальний платіж
       IF contract_number:
           candidate_client = lookup_by_contract_number(contract_number)
           IF candidate_client AND candidate_client.legal_id == payer_legal_id:
               client = candidate_client
           ELIF candidate_client AND candidate_client.legal_id != payer_legal_id:
               return in_queue(reason=ambiguous_client)
           ELSE:
               # Номер договору не зматчено в БД, пробуємо по ЄДРПОУ
               client = lookup_by_legal_id(payer_legal_id)
               IF NOT client:
                   return in_queue(reason=no_match)
       ELSE:
           # Без номера договору — тільки ЄДРПОУ
           client = lookup_by_legal_id(payer_legal_id)
           IF NOT client:
               return in_queue(reason=no_match)

3. ПЕРЕВІРКА AUTO_ACT_DISABLED
   IF client.auto_act_disabled:
       return awaiting_review(reason=auto_act_disabled)
       # Прим.: auto_act_disabled має пріоритет над edo_provider, бо вказує
       # на потенційну проблему з даними (D-036). edo_provider клієнта
       # все одно врахується пізніше, коли адмін натисне "Згенерувати акт".

3b. ПЕРЕВІРКА EDO PROVIDER (D-036)
   IF client.edo_provider == 'vchasno_external':
       return awaiting_review(reason=external_edo)

4. ВИЗНАЧЕННЯ ТИПУ ПОСЛУГИ
   # Автокласифікація повертає ТІЛЬКИ access або sms.
   # service_type = other присвоюється виключно вручну в адмінці (D-016).
   purpose_lower = payment.purpose.lower()
   IF any(keyword in purpose_lower for keyword in settings.sms_keywords):
       service_type = sms
   ELSE:
       service_type = access  # default

5. ПЕРЕВІРКА ПОВНОТИ ДАНИХ КЛІЄНТА
   # Перенесено сюди з кінця класифікації (D-017), щоб не використовувати
   # fallback ціни при відсутності apartments_count.
   missing = []
   IF NOT client.email:
       missing.append("email")
   IF NOT client.address:
       missing.append("address")
   IF NOT client.bank_name:                                 # D-022
       missing.append("bank_name")
   IF NOT client.bank_account:                              # D-022
       missing.append("bank_account")
   IF client.contract IS NULL:                              # D-019
       missing.append("contract")
   IF service_type == access
      AND client.access_price_override IS NULL
      AND client.apartments_count IS NULL:
       missing.append("apartments_count")
   IF missing:
       return in_queue(reason=client_incomplete)
   # Деталі missing-полів обчислюються UI на льоту з поточного стану клієнта,
   # не зберігаються в Payment (D-017).

6. РЕЗОЛВ ЦІНИ
   IF service_type == access:
       unit_price = client.access_price_override
                    OR tariff_lookup(client.apartments_count, payment.date).price
   IF service_type == sms:
       unit_price = resolve_sms_price(payment.date)   # D-026: окрема сутність SmsPrice

7. ВИЗНАЧЕННЯ QUANTITY
   IF service_type == access:
       IF payment.amount % unit_price != 0:
           return in_queue(reason=amount_mismatch)
       quantity = payment.amount / unit_price
   IF service_type == sms:
       parsed_quantity = parse_sms_quantity_from_purpose(payment.purpose)
       IF parsed_quantity * unit_price != payment.amount:
           return in_queue(reason=sms_quantity_mismatch)
       quantity = parsed_quantity

8. ГЕНЕРАЦІЯ АКТУ
   act_date = last_day_of_month(payment.date)
   act_number = generate_next_act_number(client, act_date.year, act_date.month)
   act = create_act(..., edo_provider=client.edo_provider)   # snapshot, D-036
   IF act.edo_provider == 'dubidoc':
       send_to_edo(act)   # API-виклик у Дубідок, act.status → sent_to_edo
   # Для edo_provider=vchasno_external API-виклик не виконується:
   # акт залишається в act.status=draft, адмін підписує у Вчасно поза системою
   # і потім натискає "Позначити підписаним" (act.status → signed).
   payment.status = classified
   return success
```

---

## Логіка генерації номера акту

```
generate_next_act_number(client, year, month):
    month_num = month  # 1..12
    existing_count = count(Act WHERE client_id=client.id
                                 AND YEAR(act_date)=year
                                 AND MONTH(act_date)=month)
    IF existing_count == 0:
        return f"№{month_num}"
    ELSE:
        return f"№{month_num}/{existing_count + 1}"
```

**Приклади:**

- Перший акт за травень: `№5`
- Другий акт за травень тому самому клієнту: `№5/2`
- Третій: `№5/3`

Нумерація **окрема для кожного клієнта**.

---

## Логіка резолву ціни (тариф або override)

```
resolve_access_price(client, payment_date):
    # 1. Override має пріоритет
    IF client.access_price_override IS NOT NULL:
        return client.access_price_override

    # 2. Тарифна сітка (D-018).
    # apartments_count гарантовано NOT NULL для access без override (D-017).
    # Сітка гарантовано має catch-all правило (apartments_max IS NULL) — інваріант
    # підтримується CRUD-валідацією, тому tariff_lookup завжди повертає правило.
    tariff = SELECT * FROM tariffs
             WHERE effective_from <= payment_date
               AND apartments_min <= client.apartments_count
               AND (apartments_max >= client.apartments_count OR apartments_max IS NULL)
             ORDER BY
                 -- ranged правила перед catch-all
                 CASE WHEN apartments_max IS NULL THEN 1 ELSE 0 END ASC,
                 -- серед однакового типу: вужчий діапазон перед ширшим
                 (apartments_max - apartments_min) ASC,
                 -- серед однакового діапазону: свіжіша версія перед старішою
                 effective_from DESC
             LIMIT 1
    return tariff.price
```

---

## Регулярки для парсингу номера договору

Стартовий набір патернів (зберігається в `settings.contract_regex_patterns`, редагується через адмінку):

```
1. /договір\s*[№#N]?\s*(\d{5,6})/i              # "договір №556770"
2. /дог[оi]в[оi][рp]\s*[№#N]?\s*(\d{5,6})/i      # опечатки "договiр", "договiо"
3. /dogovir\s*[№#N]?\s*(\d{5,6})/i               # латиниця "dogovir 556770"
4. /(\d{6})\s+ЗГІДНО\s+ДОГОВОРУ/i                # "556434 ЗГІДНО ДОГОВОРУ"
5. /[№#N]\s*(\d{5,6})(?!\d)/i                    # просто "№556770" без слова
```

Нестандартні формати (WB-4, 011220 тощо) обробляються окремими патернами, які додаються в адмінку у міру виявлення.

---

## Інтеграції

### ПриватБанк Автоклієнт API

- Polling: 1 раз/год
- Endpoint: GET транзакцій за період
- Idempotency: по `bank_transaction_id`
- Реюз коду: `/Users/Pro/Projects/privatbank-telegram-bot`

### Дубідок API

- Створення документа з прив'язкою до контрагента
- Передача email для авто-розсилки підписаного документа
- Реюз коду: `/Users/Pro/Projects/zbory_v2`
- TODO: уточнити, чи передаються реквізити контрагента inline, чи потрібен окремий sync довідника
- Застосовується тільки для клієнтів з `edo_provider = dubidoc` (D-036).

### Вчасно (зовнішнє ЕДО, без API-інтеграції) — D-036

- Канал для клієнтів з `client.edo_provider = vchasno_external`.
- Система генерує PDF локально (через той самий headless browser pipeline, що й для Дубідок — D-028). API-виклику немає, документ не відправляється автоматично.
- Адмін викачує PDF з адмінки, завантажує у Вчасно (vchasno.ua) вручну, ставить підпис там.
- Після підпису адмін повертається в адмінку і натискає "Позначити підписаним" → `Act.status` стає `signed`.
- Поля `Act.edo_doc_id` та `Act.edo_status` для таких актів завжди NULL.
- Polling Дубідок (`dubidoc_poll_interval_hours`) на ці акти не діє.

### MySQL "Моє ОСББ" (read-only)

- Автоматичний sync за розкладом `settings.moeosbb_sync_schedule` (D-023): `first` (1-го числа місяця) / `last` (останній день місяця) / `manual` (без автоматичного, тільки за кнопкою). Default — `first`.
- Кнопка "Синхронізувати зараз" в UI 8.7 доступна завжди, незалежно від розкладу.
- Тільки для записів з `moeosbb_user_id IS NOT NULL`
- Поля синхронізації: див. розділ Client

---

## Non-goals (явні обмеження моделі)

- НЕ моделюємо інвойси (не використовуються бізнес-моделлю)
- НЕ моделюємо облік оплачених періодів (це в "Моє ОСББ")
- НЕ моделюємо облік СМС-балансу (це в "Моє ОСББ")
- НЕ моделюємо звітність ФОП/ЄП (поза скоупом)
- НЕ моделюємо багатокористувацький доступ (single admin)

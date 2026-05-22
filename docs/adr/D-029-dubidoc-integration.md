# D-029 — Дубідок integration: inline participants, polling-only статуси, Premium-план

**Дата:** 2026-05-18

**Рішення:**

1. **Premium-план Дубідок** обов'язковий для роботи системи. Це дає змогу при створенні документа передавати поля `date`, `number`, `amount`, `participants[]`, `attributes[]`. Без Premium — авто-відправка підписаного акту клієнту неможлива через API, що ламає ключовий сценарій (D-001).
2. **Реквізити контрагента передаються тільки inline в `participants[]`** при кожному `POST /api/v1/documents`. Окремий sync довідника `/api/v1/contacts` НЕ виконується.
   - Дубідок сам автоматично заводить контрагентів зі своїх participants (це його внутрішня поведінка).
   - Контент `participants[]`: один елемент з `action="sign"`, `email` і `edrpou` з `Act.client_snapshot`, `priority=1`, `isSignatureRequired=true`. Підпис власника (ФОПа) — окремою операцією через UI Дубідок (D-001 — ручний підпис).
3. **Статуси документа отримуються polling-ом**, не webhook'ами:
   - Webhook callbackUrl у `POST /documents` НЕ передається.
   - Cron-задача раз в `Settings.dubidoc_poll_interval_hours` (default = 6) робить `GET /api/v1/documents/{id}` для всіх `Act` зі статусом `sent_to_edo` (не `signed`, не `deleted`).
   - Мапінг полів відповіді на нашу модель:
     - `status` Дубідок ∈ {`signed`} → `Act.status = signed`
     - `archived = true` → `Act.status = deleted` (Дубідок не дає окремого "delete", використовуємо archive як еквівалент)
     - `refused = true` → `Act.edo_status` фіксується, але `Act.status` залишається `sent_to_edo`; адмін бачить у UI 8.6 індикатор "клієнт відмовився" і вирішує далі вручну
     - інші Дубідок-статуси (`new`, `viewed`, `sent_for_sign`, `waiting_for_*`) → `Act.status` лишається `sent_to_edo`; деталь записується в `Act.edo_status` (тип `text`, не enum — Дубідок-набір занадто широкий і нестабільний для нашого ENUM)
4. **Тип `edo_status` у моделі:** змінюється з ENUM на `text` (nullable) — зберігаємо raw-значення Дубідок-статусу як snapshot останнього polling-у, без типізації.
5. **Нові ключі в Settings:**
   - `dubidoc_poll_interval_hours` (default 6) — інтервал polling статусу актів у Дубідок.
   - Перейменування існуючого `polling_interval_minutes` → `privatbank_polling_interval_minutes` для однозначності (раніше неявно стосувався ПриватБанку).

**Альтернативи:**

- **Webhook + retry (32×).** Відкинуто: вимагає публічного endpoint, який треба захистити (secret в URL, валідація HMAC — Дубідок не дає сігнатури), складніше для self-hosted single-admin сценарію. Для бізнес-цінності "побачити підпис негайно" компроміс: 6 годин затримки прийнятні (підпис не є тригером дій нашої системи; адмін бачить результат при наступному заході в UI).
- **Sync довідника contacts.** Відкинуто: дублює source of truth (наш Client). Якщо адмін зайде в UI Дубідок — побачить контрагентів автоматично (Дубідок створює зі participants). Окремий sync — додаткова синхронізація без додаткової функції.
- **Webhook + polling як fallback.** Відкинуто: складніше за обидва шляхи окремо. Якщо колись додамо webhook — це Phase 2, але на MVP polling самодостатній.
- **Без Premium.** Відкинуто: ключовий сценарій авто-відправки клієнту після підпису ламається. Адмін мусив би вручну надсилати в Дубідок UI — це втрата 50% автоматизації.

**Обґрунтування:**

- Polling-only знімає вимогу публічного HTTPS endpoint, що спрощує деплой і безпеку (no inbound traffic surface beyond admin UI).
- Single-admin (D-001) толерує 6-годинну затримку у виявленні підпису — це не блокує жодних автоматичних дій.
- Inline participants мінімізує state, який треба синхронізувати: client_snapshot у Act — єдине джерело істини для документа.

**Наслідки:**

- В моделі `Act.edo_status`: тип з `edo_status` ENUM → `text` (nullable). ENUM `edo_status` видаляється з PostgreSQL declaration.
- В моделі Settings: rename `polling_interval_minutes` → `privatbank_polling_interval_minutes`; додати `dubidoc_poll_interval_hours` (default 6).
- В PRD 7.2 фіксується вся інтеграція з Дубідок як описано вище.
- В PRD 9.7 (збій Дубідок API) — retry + банер 10.4.
- В PRD 9.9 (видалення акту в Дубідок) — виявляється polling-ом через `archived=true`, мапиться на `Act.status=deleted`. Платіж відв'язується (`Payment.act_id = NULL` за D-025), стає доступним для повторної класифікації.
- В PRD 10.1 — НЕ потрібен публічний HTTPS endpoint для callback.
- Версія `domain_model.md` → 0.9.1 (patch — зміна типу одного поля, перейменування одного ключа Settings, додавання одного ключа).

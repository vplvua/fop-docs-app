# D-024 — Двигун локальної БД: PostgreSQL

**Дата:** 2026-05-18

**Рішення:** Локальна БД системи генерації актів — PostgreSQL. Закриває відкрите питання, залишене в D-004.

**Альтернативи:**

- **MySQL** — як в "Моє ОСББ", уніфікація технологій на сервері. Відкинуто: уніфікація не дає переваг для нашого read-only sync-сценарію, а в snapshot-полях (`client_snapshot`, `contract_snapshot`, `Payment.raw_data`) JSON-операції в PostgreSQL (jsonb, GIN-індекси) суттєво зручніші для аналітики і дебагу.
- **SQLite** — простота, один файл, мінімум операційних витрат. Відкинуто: бекап і live-debug (підключення SQL-клієнтом з ноута) суттєво гірше, replication неможливий, а виграш від простоти на 300 клієнтах і ~500 платежах/міс не вартий цих обмежень.
- **Лишити відкритим до коду.** Відкинуто: вибір БД впливає на формулювання в PRD (типи полів, native enum, jsonb-операції в логіці).

**Обґрунтування:**

- 4 поля типу JSON в моделі (`Act.client_snapshot`, `Act.contract_snapshot`, `Payment.raw_data`, `Settings.contract_regex_patterns` як список) — jsonb з GIN-індексами дає кращу швидкість і ergonomics.
- Native enum в PostgreSQL (`CREATE TYPE ... AS ENUM`) — чітко відображає stateful поля з D-014, D-016 без CHECK-constraints.
- Транзакційні гарантії і `SELECT ... FOR UPDATE` потрібні для генерації номера акту (race-condition safe — D-005).
- Standalone сервер легко бекапиться `pg_dump`, легко відновлюється; дамп безпечно передавати (після D-020 credentials не в БД).

**Наслідки:**

- В PRD розділах 3 і 10.1 фіксується PostgreSQL.
- Типи полів у `domain_model.md` уточнюються: `UUID → uuid`, `INT → integer/bigint`, `decimal → numeric(N,M)`, `JSON → jsonb`, enum → native ENUM (`payment_status`, `act_status`, `service_type`, `classification_reason`, `moeosbb_sync_schedule`).
- В розділі 10.5 (Розгортання) додається вимога: бекап через `pg_dump` за розкладом.
- Версія `domain_model.md` → 0.7.1 (patch — уточнення типів без зміни логіки).

**Переглядає:** D-004 (там вибір БД був явно відкладений).

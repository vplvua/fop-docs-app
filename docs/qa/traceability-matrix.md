# QA traceability matrix

**Призначення:** один погляд → всі FR покриті specs, тестами, demo recordings.

**Як читати:**

- **FR ID** — функціональна вимога з [`docs/prd.md`](../prd.md) або NFR/TC/BC.
- **Capability** — slice з [`docs/mvp-capability-plan.md § 5`](../mvp-capability-plan.md).
- **Spec** — OpenSpec spec/requirement (`openspec/specs/<capability>/spec.md#scenario`).
- **Test** — посилання на unit / integration / e2e файл.
- **Demo recording** — `docs/qa/recordings/<file>.mp4` або URL.

**Як оновлювати:**

- Кожен PR, що додає / змінює capability → оновлює відповідні рядки (нові FR-ID, нові тести, нові recordings).
- CI не валідує цей файл автоматично у Phase 0 — це робить reviewer перед merge.
- Якщо FR ще не реалізовано — лишай `—` у Test/Demo, але запиши capability та статус.

---

## Active matrix

| FR ID                                                                     | Capability | Spec | Test | Demo recording |
| ------------------------------------------------------------------------- | ---------- | ---- | ---- | -------------- |
| _(порожньо — Phase 0 ще не стартував; перший рядок з'явиться з S1. auth)_ |            |      |      |                |

---

## Legend

- **Status у Spec колонці:**
  - `openspec/specs/<cap>/spec.md#<req-id>` — accepted spec
  - `openspec/changes/<change>/specs/<cap>/spec.md#<req-id>` — proposal в роботі
  - `—` — ще не специфіковано
- **Test колонка:** шлях відносно `tests/` (наприклад, `unit/auth/login.test.ts`)
- **Demo recording колонка:** шлях відносно `docs/qa/recordings/` або повний URL

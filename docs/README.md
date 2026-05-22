# docs/

Документація проекту. Структура побудована під openspec / spec-driven development: нормативні артефакти (PRD, доменна модель, ADR) живуть тут, специфікації змін — у `openspec/`.

## Що де

| Файл / папка                                             | Призначення                                                                                 | Коли читати                                                                            |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| [`prd.md`](prd.md)                                       | **Нормативний PRD** з ідентифікаторами вимог (FR-_ / NFR-_ / TC-_ / BC-_)                   | Перед будь-якою роботою над фічею — щоб знати, які вимоги вона задовольняє             |
| [`mvp-capability-plan.md`](mvp-capability-plan.md)       | **Phase 0 capability slicing** з dependency graph; розрізає MVP на 13 deploy-готових зрізів | Перед стартом будь-якого зрізу — щоб знати, що саме входить і від чого залежить        |
| [`current-state.md`](current-state.md)                   | Snapshot готовності системи (phase, last slice, next slice, blockers)                       | Перший файл за Project Handoff Protocol (`AGENTS.md`); оновлюється в DoD кожного зрізу |
| [`prd-rationale.md`](prd-rationale.md)                   | Повна версія PRD з обґрунтуваннями, сценаріями, edge cases                                  | Коли треба зрозуміти **чому** саме така вимога, не тільки що                           |
| [`domain-model.md`](domain-model.md)                     | Канонічна доменна модель: сутності, поля, інваріанти, FK-поведінка                          | Перед редагуванням схеми БД, моделей, логіки класифікації                              |
| [`domain-model-changelog.md`](domain-model-changelog.md) | Журнал змін доменної моделі (semver)                                                        | Коли треба простежити еволюцію поля/enum                                               |
| [`adr/`](adr/README.md)                                  | Architectural Decision Records (D-001 … D-036, по файлу на рішення)                         | Коли пропонуєш рішення, що може суперечити вже прийнятому                              |
| [`api-docs/`](api-docs/)                                 | Специфікації зовнішніх API (ПриватБанк, Дубідок)                                            | При роботі над відповідною інтеграцією                                                 |
| [`samples/acts/`](samples/acts/)                         | PDF-зразки актів (access, sms, рік-наперед)                                                 | При роботі над PDF-шаблоном — структура і формулювання мають відповідати зразкам       |
| [`research/`](research/)                                 | Аналіз реальної банківської виписки (без самих виписок — лише висновки)                     | При роботі над класифікатором (regex-патерни, статистика)                              |
| [`qa/recordings/`](qa/recordings/)                       | Demo recordings з кожного capability slice                                                  | DoD-артефакт; додається при кожному merge зрізу                                        |

## Workflow при початку нової capability

1. Прочитай `current-state.md` — знай поточну фазу, останній merged зріз, blockers.
2. Прочитай відповідну секцію в `mvp-capability-plan.md § 5` — зрозумій scope, deliverables, depend on, demo criteria.
3. Відкрий OpenSpec change через `Skill(openspec:propose)` → fill `proposal.md` → `design.md` → `tasks.md` → `spec.md`.
4. Implement (schema → service → server actions → UI → tests).
5. Пройди Definition of Done з `mvp-capability-plan.md § 6`.
6. `openspec archive`, оновлення `current-state.md`, demo recording у `qa/recordings/`.

## Правила оновлення

- **`prd.md`** і **`domain-model.md`** — нормативні. Зміни сюди вносяться лише після прийняття ADR.
- **`adr/`** — append-only. Нові рішення додаються новим файлом `D-NNN-<slug>.md`; старі immutable. Якщо рішення переглядається — новий ADR з `**Переглядає:** D-XXX`.
- **`prd-rationale.md`** — historical document, оновлюється рідко (тільки якщо змінюється бізнес-контекст, не вимоги).
- **`domain-model-changelog.md`** — оновлюється разом із `domain-model.md`, semver-bump відображає характер зміни.
- **`samples/`**, **`api-docs/`**, **`research/`** — read-only reference; оновлюються лише при отриманні нових даних/специфікацій.

## Конвенції посилань

- На ADR — короткий ID у тексті (`D-024`), повне посилання у markdown-документах (`[D-024](adr/D-024-postgres.md)`).
- На вимогу PRD — короткий ID (`FR-CLASS-05`, `NFR-PERF-02`).
- На розділ `prd-rationale.md` — `prd-rationale.md § 4.3`.

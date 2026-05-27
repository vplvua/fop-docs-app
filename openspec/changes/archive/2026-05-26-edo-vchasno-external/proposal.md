## Why

Клієнти з `edo_provider = vchasno_external` наразі класифікуються у `awaiting_review(external_edo)`, але UI не надає інструментів для ручного EDO-workflow: створення акту з черги, завантаження PDF, позначення підписаним/скасування. Це блокує повний цикл виставлення актів для Вчасно-клієнтів — останню EDO-гілку перед dashboard polish (S13).

## What Changes

- Додати server actions `markActSigned` / `unmarkActSigned` для state-machine `draft ↔ signed` (тільки `vchasno_external`).
- Дозволити `regeneratePdf` у будь-якому статусі для `vchasno_external` актів (зараз обмежено `draft`).
- Дозволити редагування `service_description` у будь-якому статусі для `vchasno_external` (FR-ACT-06).
- Додати UI-кнопки "Позначити підписаним" / "Скасувати позначку" на картці акту для `vchasno_external`.
- Додати бейдж "Вчасно" у списку актів та відповідний фільтр.
- Жодних зовнішніх API-викликів — Вчасно працює виключно як manual external flow (TC-INTEG-04, BC-SCOPE-11).

## Capabilities

### New Capabilities

- `edo-vchasno-external`: Manual EDO workflow for Vchasno — state-machine `draft ↔ signed`, PDF regeneration in any status, mark/unmark signed UI controls. Covers FR-EDO-20..25, TC-INTEG-04.

### Modified Capabilities

_(немає змін до spec-level вимог існуючих capabilities — `edo-dubidoc` та `classification` вже обробляють `vchasno_external` як окремий шлях)_

## Impact

- **`app/(dashboard)/acts/[id]/`** — act detail panel: нові кнопки, розширена логіка `canEdit` / `canRegenerate`.
- **`app/(dashboard)/acts/`** — act list: бейдж "Вчасно" для `vchasno_external` актів.
- **`app/(dashboard)/acts/[id]/act-actions.ts`** — нові server actions `markActSigned`, `unmarkActSigned`; розширення `regeneratePdfAction` для зняття обмеження статусу.
- **`lib/edo/`** — можливий новий модуль `vchasno-state.ts` з domain-логікою state-machine.
- **Без нових таблиць/міграцій** — використовуються існуючі поля `Act.status`, `Act.edo_provider`.
- **Без зовнішніх залежностей** — no API calls, no new env vars, no cron jobs.

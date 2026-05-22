# D-039 — MSW як єдина стратегія HTTP-моків у тестах

**Дата:** 2026-05-22

**Доповнює:** [D-037](D-037-quality-gates-stack.md) (test stack — Vitest + Playwright).

**Рішення:**

1. **MSW (Mock Service Worker)** — єдина точка моків зовнішніх HTTP API:
   - PrivatBank Автоклієнт (Slice 6: payments-ingest).
   - Дубідок (Slice 9: edo-dubidoc).
   - Будь-які інші майбутні HTTP-провайдери.
2. **Спільні handlers** у `tests/mocks/handlers/<provider>.ts` між:
   - unit-тестами (vitest, Node) — через `setupServer()`.
   - integration-тестами (vitest, Node) — той самий server.
   - E2E (Playwright, browser) — через `setupWorker()` (підключається з S2+).
3. **Stateful scenarios:** handlers зберігають in-memory стан для моделювання реальних flow (queue → retry → success), а не повертають статичні JSON.
4. **Fixtures:** реальні response samples тримаються у `tests/mocks/fixtures/<provider>/*.json`. Один зразок = одна реальна відповідь з API, не вигадана.
5. **Інсталяція відкладається** до Slice 6 (перший external HTTP). У `tests/mocks/README.md` — convention документована вже зараз.

**Винятки (mock-и НЕ через MSW):**

- **MoeOSBB MySQL** — викликається не fetch, а через `mysql2` (D-004). MSW не перехоплює DB-протоколи. Стратегія для нього — окрема: real read-only MySQL у Docker/тестовому інстансі або mock на рівні `lib/external-apis/moeosbb/` сервіса (`vi.mock('@/lib/external-apis/moeosbb')`).
- **Postgres (Neon)** — integration smoke-тести бігають на реальній test-БД (Neon branch), не мокаються (D-024 + D-038).

**Альтернативи:**

- **`vi.mock('node:fetch')` ad-hoc inline.** Відкинуто. Дешево на старті, але:
  - Кожен тест мокає по-своєму → контракт API розмазаний по сотнях тестів.
  - Не працює в Playwright (різні фази).
  - При зміні endpoint-у треба переписувати десятки тестів замість одного handler.
- **`nock`.** Відкинуто. Класичний, але:
  - Тільки server-side (немає browser worker).
  - Менш гнучкий для stateful flows.
  - Слабша підтримка ESM.
- **Запис реальних відповідей у fixture-и + replay (Polly.js).** Відкинуто для MVP. Корисно для regression, але початково — overkill і вимагає тестового sandbox-токену від кожного провайдера до того, як ми починаємо писати тести.

**Обґрунтування:**

- **Один контракт у одному місці.** При зміні endpoint-у — правимо handler, тести продовжують працювати; якщо real API розійшовся з handler-ом — це diff проти fixture-ів, видно одразу.
- **Stateful = реалістично.** Для payments-ingest classifier треба моделювати "перший виклик повертає queue, другий — completed" — MSW це робить нативно через handler state.
- **Спільний код Node + browser.** Один і той самий handler у unit, integration, Playwright — мінімальне дублювання.
- **AI-агент-friendly:** структура `tests/mocks/handlers/<provider>.ts` передбачувана, агент бачить весь external HTTP surface як TS-код у repo.

**Наслідки:**

- У Slice 6 (payments-ingest) додаються deps: `msw` (dev). Створюються:
  - `tests/mocks/server.ts` — `setupServer(...handlers)` для Node.
  - `tests/mocks/handlers/privatbank.ts`.
  - `tests/mocks/fixtures/privatbank/*.json`.
  - `tests/setup.ts` оновлюється: `beforeAll(() => server.listen()); afterEach(() => server.resetHandlers()); afterAll(() => server.close());`.
- У Slice 9 додається `handlers/dubidoc.ts`.
- З першим E2E-тестом (Playwright, S2+ або S6+) — `tests/mocks/browser.ts` (`setupWorker`) + `mockServiceWorker.js` у `public/` (генерується через `npx msw init public/`).
- Code review гайдрейл: PR з inline `vi.mock` на HTTP-клієнт → блокується reviewer-ом, автор переносить handler у `tests/mocks/handlers/`.
- `tests/mocks/` не імпортується з production-коду (`app/`, `lib/`) — це тест-only артефакт.

# HTTP mocks

Цей каталог — єдина точка для mock-handler-ів зовнішніх HTTP API
(PrivatBank Автоклієнт, Дубідок, MoeOSBB у частинах, де викликається HTTP).

## Стек

**MSW (Mock Service Worker)** — узгоджено в [ADR D-039-test-http-mocks](../../docs/adr/D-039-test-http-mocks.md).

**Чому MSW:**

- Перехоплює на рівні `fetch` / network — той самий handler працює і в unit-тестах,
  і в integration-тестах, і в E2E (Playwright).
- Stateful — можна моделювати реальні сценарії: queue → retry → success.
- Один опис контракту замість inline `vi.mock` у кожному тесті.

## Коли інсталювати

MSW **ще не встановлений**. Перший capability, який його потребує — **S6 (payments-ingest)**:
PrivatBank Автоклієнт API. Тоді ж:

1. `npm install -D msw`
2. Створити `tests/mocks/handlers/privatbank.ts` з усіма використовуваними endpoint-ами.
3. Створити `tests/mocks/server.ts` (`setupServer(...handlers)`) і додати в
   `tests/setup.ts`: `beforeAll(() => server.listen()); afterEach(() => server.resetHandlers()); afterAll(() => server.close());`
4. Для Playwright (з S2+) — `tests/mocks/browser.ts` (`setupWorker(...handlers)`).

## Структура каталогу (плановано)

```
tests/mocks/
├── README.md            # цей файл
├── handlers/
│   ├── privatbank.ts    # від S6
│   ├── dubidoc.ts       # від S9
│   └── moeosbb.ts       # від S11 (через mysql2 — окремий патерн, не fetch)
├── server.ts            # вузол для Node (vitest)
├── browser.ts           # вузол для browser (Playwright)
└── fixtures/            # JSON-зразки реальних відповідей
    ├── privatbank/
    ├── dubidoc/
    └── moeosbb/
```

## Anti-pattern

Не використовуй `vi.mock('node:fetch')` або `nock` ad-hoc у тесті — це фрагментує
контракт. Якщо потрібен mock — додай handler у `handlers/<provider>.ts`.

## Винятки

- **MoeOSBB MySQL** — викликається не через fetch, а через `mysql2` (D-004). MSW
  не перехоплює DB-протоколи. Для нього — окрема стратегія: real MySQL у
  Docker / Neon branch або mock на рівні `lib/external-apis/moeosbb/` сервіса.
- **DB (Neon Postgres)** — інтеграційні тести бігають на реальній test-БД
  (Neon branch) per ADR D-024, не мокаються.

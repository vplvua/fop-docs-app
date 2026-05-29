# S12 — queue (polish)

> **Статус:** manual smoke pending (human-gated). Код завершено, `npm run qa` 6/6 green.
> Цей файл — сценарій ручного прогону `/queue` на Neon dev branch. Запис GIF/скрінів
> додається перед merge (без реальних PII — staging-fixtures).

## Передумови

```bash
nvm use
npx vercel env pull .env.local --yes   # POSTGRES_URL (dev branch) та ін.
npm run dev
```

Засіяти платежі на всі reason-гілки (повторно використати наявний скрипт):

```bash
node scripts/seed-classification-test.mjs
```

## Сценарій (Demo criteria § 5 S12 — ≤ 2 хв на платіж)

1. Логін → top-bar показує **Черга** з бейджем-лічильником (`awaiting_review + in_queue`).
2. Відкрити `/queue` → активна вкладка **На апрув** за замовчуванням; URL без `tab`.
3. Перемкнути на **Проблеми класифікації** (`?tab=in_queue`); групи відсортовані за
   пріоритетом: `no_match` → `multiple_clients_same_edrpou` → `client_incomplete` →
   `multiple_contracts` → `amount_mismatch` → `sms_quantity_mismatch` → `external_edo`.
4. **no_match:** пошук існуючого клієнта + кнопка «Створити нового клієнта» (prefill
   payer). Привʼязка валідного клієнта → платіж зникає з черги (рекласифікація).
5. **multiple_clients_same_edrpou:** селектор лише активних кандидатів (договір + Моє
   ОСББ), архівовані приховані; вибір → link → платіж зникає.
6. **client_incomplete:** список відсутніх полів з deep-links у `/clients/[id]?tab=…`.
   Заповнити поле → «Класифікувати ще раз» → платіж зникає.
7. **multiple_contracts:** radio зі знайденими номерами договорів.
8. **amount_mismatch / sms_quantity_mismatch:** показано суму, тариф/ціну СМС, поділ.
9. **external_edo:** бейдж «Вчасно» + підказка про ручний workflow.
10. **Пропустити** на будь-якому платежі → статус `skipped` (термінальний), зникає з
    обох вкладок, лічильник у top-bar зменшується.
11. Порожня вкладка → empty-state message.

## Автоматизоване покриття

- `tests/unit/queue/{group,missing-fields,reasons}.test.ts` — 18 тестів (групування,
  порядок, парність missing-fields із класифікатором D-017, parseReason).
- E2E (Playwright) — відкладено: не налаштовано в Phase 0 (як і S2–S11).

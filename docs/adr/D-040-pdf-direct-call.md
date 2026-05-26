# D-040 — PDF генерація викликається напряму з server action, без HTTP-hop через API route

**Дата:** 2026-05-26

**Переглядає:** D-028 (уточнює спосіб виклику, не змінює вибір headless browser)

**Рішення:**

Server action `regeneratePdfAction` викликає `generateAndStoreActPdf()` напряму (render → Blob upload → DB update) замість проміжного `fetch("POST /api/acts/{id}/pdf")`.

**Альтернативи:**

- **Виключити `/api/acts/*/pdf` з auth proxy.** Відкинуто: робить ендпоінт публічним, порушує NFR-SEC периметр. Потребує або shared secret, або IP whitelist — зайва складність.
- **Прокидати session cookie у внутрішній fetch.** Відкинуто: крихке рішення — залежить від деталей cookie-передачі між Vercel Functions, ламається при зміні auth-стратегії.
- **Використати Next.js `after()` для fire-and-forget.** Розглянуто для `updateServiceDescriptionAction`; поки залишено `.catch(() => {})` — достатньо для MVP, `after()` можна додати пізніше якщо з'являться проблеми з передчасним завершенням функції.

**Обґрунтування:**

На Vercel proxy (`proxy.ts`) захищає всі роути авторизацією. Внутрішній `fetch` із server action до API route не передає session cookies → proxy повертає 307 redirect на `/login` → PDF не генерується. Прямий виклик обходить HTTP-шар повністю: server action вже авторизований, має доступ до DB і Blob — проміжний API route непотрібний.

**Наслідки:**

- `lib/acts/generate-pdf.ts` експортує `generateAndStoreActPdf()` (повний цикл: DB read → render → upload → DB update) замість `triggerPdfGeneration()` (HTTP trigger).
- API route `/api/acts/[id]/pdf` залишається (використовує ту саму `generateAndStoreActPdf`), але не є основним шляхом генерації — лише для можливого зовнішнього виклику.
- `next.config.ts` додає `serverExternalPackages: ["@sparticuz/chromium"]` для коректного бандлінгу Chromium binary на Vercel.
- UI кнопки "Перегенерувати PDF" тепер показує помилку якщо генерація не вдалась (раніше помилка проковтувалась).

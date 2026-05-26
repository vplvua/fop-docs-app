# D-040 — PDF генерація викликається напряму з server action, без HTTP-hop через API route

**Дата:** 2026-05-26

**Переглядає:** D-028 (замінює headless browser на програмний рендер; уточнює спосіб виклику)

**Рішення:**

1. Server action `regeneratePdfAction` викликає `generateAndStoreActPdf()` напряму (render → Blob upload → DB update) замість проміжного `fetch("POST /api/acts/{id}/pdf")`.
2. PDF рендериться через `@react-pdf/renderer` (програмний React → PDF) замість Puppeteer + headless Chromium. Шаблон акту переписаний з HTML-компонентів на `@react-pdf` компоненти (`Document`, `Page`, `View`, `Text`).

**Альтернативи:**

- **Виключити `/api/acts/*/pdf` з auth proxy.** Відкинуто: робить ендпоінт публічним, порушує NFR-SEC периметр. Потребує або shared secret, або IP whitelist — зайва складність.
- **Прокидати session cookie у внутрішній fetch.** Відкинуто: крихке рішення — залежить від деталей cookie-передачі між Vercel Functions, ламається при зміні auth-стратегії.
- **Залишити Puppeteer + `@sparticuz/chromium`.** Відкинуто: бінарник ~50MB не бандлиться коректно на Vercel навіть з `serverExternalPackages`. `@sparticuz/chromium-min` (runtime download) — додає latency і зовнішню залежність на S3.
- **Використати Next.js `after()` для fire-and-forget.** Розглянуто для `updateServiceDescriptionAction`; поки залишено `.catch(() => {})` — достатньо для MVP, `after()` можна додати пізніше якщо з'являться проблеми з передчасним завершенням функції.

**Обґрунтування:**

Дві окремі проблеми:

1. **Auth proxy блокує внутрішній fetch.** На Vercel proxy (`proxy.ts`) захищає всі роути авторизацією. Внутрішній `fetch` із server action до API route не передає session cookies → proxy повертає 307 redirect на `/login` → PDF не генерується. Прямий виклик обходить HTTP-шар повністю: server action вже авторизований, має доступ до DB і Blob.
2. **Chromium не працює на Vercel.** `@sparticuz/chromium` потребує `bin/` директорію з бінарником ~50MB; Vercel file tracing не включає її у function bundle навіть з `serverExternalPackages`. `@react-pdf/renderer` — програмний рендер без зовнішніх бінарників, працює скрізь де є Node.js.

**Наслідки:**

- `lib/acts/generate-pdf.ts` експортує `generateAndStoreActPdf()` (повний цикл: DB read → render → upload → DB update) замість `triggerPdfGeneration()` (HTTP trigger).
- `lib/pdf/render.ts` використовує `@react-pdf/renderer` (`renderToBuffer`) замість Puppeteer. Залежності `puppeteer-core` і `@sparticuz/chromium` видалено.
- `lib/pdf/act-template.tsx` переписаний з HTML-елементів на `@react-pdf` компоненти (`Document`, `Page`, `View`, `Text`, `Font`). Шрифт Times New Roman підвантажується з CDN при першому рендері.
- API route `/api/acts/[id]/pdf` залишається (використовує ту саму `generateAndStoreActPdf`), але не є основним шляхом генерації.
- `next.config.ts`: `serverExternalPackages: ["@react-pdf/renderer"]` для коректного бандлінгу.
- UI кнопки "Перегенерувати PDF" тепер показує помилку якщо генерація не вдалась (раніше помилка проковтувалась).
- D-028 залишається чинним щодо принципів (рендер у нашій інфраструктурі, React-шаблон, privacy); змінено лише спосіб рендеру (програмний замість headless browser).

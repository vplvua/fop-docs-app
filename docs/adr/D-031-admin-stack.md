# D-031 — Стек адмінки: Next.js (App Router) + Tailwind + shadcn/ui

**Дата:** 2026-05-18

**Рішення:**

1. Фронтенд + бекенд адмінки — **Next.js (App Router)**.
2. Стилі — **Tailwind CSS**.
3. UI-компоненти — **shadcn/ui** (компоненти копіюються в проект, не npm-залежність).
4. Це той самий стек, що для PDF-шаблонів (D-028 — htmldocs DX базується на React + Tailwind), що дає reuse стилів між адмінкою і шаблонами актів.

**Альтернативи:**

- **Next.js без shadcn (власні компоненти).** Відкинуто: shadcn дає production-ready компоненти (Form, Table, Dialog, Toast) без серйозних обмежень — для single-admin адмінки виправдане прискорення.
- **Окремі фронт + бек (наприклад, React SPA + FastAPI/Hono бек).** Відкинуто: для проекту з 1 розробником монолітний Next.js (API routes + UI в одному репо) простіший для деплою і обслуговування.
- **Svelte/Vue/Solid.** Відкинуто: автор-розробник готовий працювати на React-стеку.

**Обґрунтування:**

- Next.js App Router добре підходить для CRUD-адмінки (Server Components + Actions знижують ceremonial JS).
- Один stack для адмінки і PDF-шаблонів — менше контекст-перемикань, спільні дизайн-токени Tailwind.
- shadcn/ui — компоненти володіємо локально (можемо правити), не залежимо від API сторонньої бібліотеки.

**Наслідки:**

- PRD 10.1: Next.js (App Router) як основний стек. Node.js LTS. PostgreSQL як БД (D-024).
- PRD 8.x формулюються в термінах роутів Next.js (наприклад, `/payments`, `/queue`, `/clients/[id]`).
- Cron-задачі (polling ПриватБанк, polling Дубідок, sync "Моє ОСББ") — окремий процес (Node.js worker) або Next.js scheduled API route з зовнішнім cron-тригером (vercel cron, systemd timer). Деталь 10.1.

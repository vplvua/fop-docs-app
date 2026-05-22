# D-034 — Хостинг і інфраструктура: Vercel + Neon Postgres + Vercel Blob

**Дата:** 2026-05-18

**Рішення:**

1. **Хостинг застосунку — Vercel** (Next.js App Router, Fluid Compute як runtime — повний Node.js).
2. **PostgreSQL — Neon** через Vercel Marketplace (зберігається вибір PostgreSQL з D-024; Neon — конкретний managed-провайдер).
3. **Storage PDF файлів — Vercel Blob** (приватний bucket). `Act.pdf_file_url` зберігає Vercel Blob URL з обмеженим доступом.
4. **Cron-завдання — Vercel Cron Jobs**, оголошені в `vercel.ts`:
   - ПриватБанк polling (`Settings.privatbank_polling_interval_minutes`, default 60).
   - Дубідок status polling (`Settings.dubidoc_poll_interval_hours`, default 6).
   - "Моє ОСББ" sync — `0 0 1 * *` для `first` або `0 0 L * *` для `last` (точна реалізація: один cron, який всередині перевіряє `Settings.moeosbb_sync_schedule`).
5. **PDF рендер у Vercel Function** (Fluid Compute, повний Node.js):
   - Chromium через `@sparticuz/chromium` + `playwright-core` (або еквівалент); 50MB binary вкладається в Vercel Function size limit.
   - Cold start ~3-5с — прийнятно при ~500 PDF/міс. Fluid Compute переюзає instance, тому послідовні рендери в межах invocation швидкі.
6. **Env-керування — `vercel env`**: `vercel env pull` для локального dev (`.env.local`), `vercel env add` для production/preview. Узгоджується з D-020 (env-only secrets).
7. **Конфігурація проекту — `vercel.ts`** (рекомендований формат замість `vercel.json`):
   - Cron schedules.
   - Headers / rewrites (за потребою).
   - Framework: `nextjs`.
8. **Auto TLS і CDN** надає Vercel — додаткова робота не потрібна (закриває D-032 вимогу TLS у production).

**Що відкрите і вирішується при імплементації відповідної інтеграції:**

- **Доступ до MySQL "Моє ОСББ"**: Vercel Functions ефемерні і без статичного outbound IP на Pro-плані. Варіанти, які перевіримо при роботі над 7.3:
  - Якщо "Моє ОСББ" MySQL доступний публічно з whitelist — додати egress IP діапазон Vercel.
  - Якщо ні — окремий read-only sync gateway на VPS (де живуть інші проекти власника), експонує REST-endpoint для нашого sync-cron.
  - Якщо у zbory_v2 / privatbank-telegram-bot уже є робочий patterns — реюзуємо.
- Це питання НЕ блокує Phase 0 в частині класифікації платежів — sync з "Моє ОСББ" можна відкласти, наповнивши БД клієнтів вручну/CSV-імпортом.

**Альтернативи:**

- **VPS (Hetzner/Linode) у єдиному середовищі з іншими проектами автора.** Відкинуто: інші проекти автора (zbory_v2, privatbank-telegram-bot) вже на Vercel, тому "єдине середовище" — це теж Vercel. Перехід на VPS вимагав би налаштування ще одного хоста.
- **Окремий VPS під цю систему.** Відкинуто: додаткова операційна вартість ($5-7/міс + обслуговування) без виграшу для проекту масштабу ~500 платежів/міс.
- **Self-hosted PostgreSQL (контейнер на VPS).** Відкинуто разом з VPS-варіантом. Neon — managed Postgres з безкоштовним tier-ом, autoscaling, branching для preview deploy (узгоджується з D-035).
- **AWS / GCP / Cloudflare.** Відкинуто: усі дають аналогічні можливості, але автор уже працює з Vercel — менше context switching, єдиний dashboard для управління всіма проектами.

**Обґрунтування:**

- Власник уже використовує Vercel для двох пов'язаних проектів (zbory_v2, privatbank-telegram-bot). Уніфікація платформи знижує операційну складність.
- Fluid Compute (default з 2025) знімає історичну проблему Vercel — обмеження edge runtime для серверного Node.js. Тепер Vercel — повноцінна compute платформа з 300с timeout, повним Node.js, реюзом instance.
- Vercel Cron / Vercel Blob — нативні продукти, не потребують окремої інфраструктури.
- Neon Postgres має жорстку інтеграцію з Vercel через Marketplace (auto-provisioned env vars `POSTGRES_URL` тощо), branching для preview deploy дозволяє тестувати PR-зміни на копії БД.
- Auto TLS + CDN — closing вимогу D-032 без додаткових кроків.

**Наслідки:**

- D-024 уточнюється: PostgreSQL = Neon (через Vercel Marketplace). Зміна типу полів і ENUM-ів лишається в силі.
- D-028 уточнюється: headless browser = Chromium через `@sparticuz/chromium` (або еквівалент) у Vercel Function (Fluid Compute). Cloud htmldocs.com все одно не використовуємо — рендер у нашому Function.
- В моделі `Act.pdf_file_url` лишається `text`, але значення тепер — Vercel Blob URL.
- В PRD 10.1 фіксується стек у термінах Vercel: Next.js App Router + Fluid Compute, Neon Postgres, Vercel Blob, Vercel Cron, `vercel.ts` як конфіг.
- В PRD 10.3 — TLS забезпечений платформою; env-керування через `vercel env`.
- В PRD 10.5 (Розгортання) — D-035.
- В PRD 7.3 (Моє ОСББ) — додаткова примітка про доступ до MySQL з Vercel (вирішуємо при імплементації).
- Жодних змін у `domain_model.md` — це інфраструктурне рішення, не модельне.

**Уточнює:** D-024 (Neon як конкретний PostgreSQL-провайдер), D-028 (Vercel Function як середовище рендеру PDF).

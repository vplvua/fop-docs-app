# Operations runbook — деплой і міграції

Операційний посібник: як викочувати код і застосовувати DB-міграції на різні
середовища. Читати перед будь-яким деплоєм або міграцією на production.

---

## Середовища і бази

Neon-інтеграція (`neon-fop-docs`, Neon project `odd-tree-94681936`) привʼязана до
Vercel-проекту з **окремою гілкою на кожне середовище**:

| Vercel env          | Neon branch      | Звідки конекшн                                       |
| ------------------- | ---------------- | ---------------------------------------------------- |
| Development         | dev-гілка        | `vercel env pull .env.local` (читабельна)            |
| Production, Preview | production-гілка | Sensitive — через `vercel env pull` **не читається** |

Перевірити розкладку: `vercel env ls` показує два окремі записи `POSTGRES_URL`
(`Development` і `Production, Preview`) — різні значення, різні бази.

> **Важливо.** І рантайм (`lib/db/index.ts`), і drizzle (`drizzle.config.ts`)
> читають **лише** `POSTGRES_URL`. Тож «куди піде міграція» цілком визначається
> тим, яке значення `POSTGRES_URL` у момент запуску.

---

## Міграція на **development** (дефолт)

`.env.local` містить dev-конекшн (його заповнює `vercel env pull .env.local`),
тож звичайний запуск бʼє саме в dev-гілку:

```bash
npm run db:migrate          # drizzle-kit migrate, читає POSTGRES_URL з .env.local
```

Попередження `'@neondatabase/serverless' can only connect ... through a websocket`
— **штатне**, не помилка.

---

## Міграція на **production**

Локальний `npm run db:migrate` прод **не зачіпає** — це інша Neon-гілка. Кроки:

1. **Дістати production connection string.** Прод-`POSTGRES_URL` позначений
   Sensitive у Vercel і назад не вичитується. Беремо з Neon-консолі:
   Vercel → Storage → інтеграція Neon → **Open in Neon** → перемкнути Branch на
   **production** → **Connect** → скопіювати **pooled** рядок (у хості є `-pooler`),
   роль `neondb_owner`, база `neondb`.

2. **Запустити migrate проти прод-URL.** `drizzle.config.ts` примусово вантажить
   `.env.local` (і перетер би shell-змінну), тож тимчасово прибираємо його:

   ```bash
   mv .env.local .env.local.bak
   POSTGRES_URL="<prod-pooled-url>" npx drizzle-kit migrate
   mv .env.local.bak .env.local
   ```

   Застосуються лише ще не накатані міграції (журнал drizzle на проді вже містить
   попередні).

3. **Перевірити** в Neon SQL Editor на production-гілці:

   ```sql
   SELECT count(*) FROM drizzle.__drizzle_migrations;   -- кількість зросла
   ```

> Якщо міграція — лише data-change (UPDATE/INSERT у seed), її можна замість кроку 2
> виконати руками в Neon SQL Editor на прод-гілці. drizzle потім просто пропустить
> idempotent-міграцію. Але журнал лишиться неузгодженим — тож drizzle-kit чистіший.

---

## Деплой коду

```bash
npx vercel deploy --prod        # = npx vercel --prod
```

- Деплоїть **локальний стан робочої теки**, не git. Перед запуском переконайся,
  що потрібний коміт уже в робочій теці (tree чистий).
- `vercel.ts` (framework, **crons**) читається під час білду — нові/змінені cron
  розклади реєструються автоматично. Перевірити: Vercel → Project → Settings →
  Cron Jobs.
- Якщо проект підʼєднаний до Git — простіший шлях `git push` (auto-deploy).

---

## Золоте правило послідовності

**Зміна поведінки = деплой коду + міграція прод-бази. Обидва кроки.**

Data-міграція без деплою коду нічого не дасть, якщо новий код-шлях ще не в проді
(і навпаки — новий код може очікувати дані/схему, яких ще нема). Порядок між ними
зазвичай неважливий для data-only змін; для schema-змін спершу міграція, потім код.

**Фінальна перевірка** — відкрий відповідну сторінку на проді й переконайся, що
зміна видима в реальному UI, а не лише в БД.

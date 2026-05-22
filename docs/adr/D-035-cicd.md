# D-035 — CI/CD: GitHub + Vercel auto-deploy; GitHub Actions для тестів і lint

**Дата:** 2026-05-18

**Рішення:**

1. **Auto-deploy** через Vercel GitHub Integration:
   - Push у `main` → auto-deploy у production (Vercel збирає Next.js і виставляє нову версію).
   - Pull request → Vercel preview deploy з унікальним URL — для перевірки UI/UX змін до merge.
2. **GitHub Actions** виконує перед merge у `main`:
   - lint (eslint, prettier check)
   - type-check (tsc --noEmit)
   - unit tests (за наявності)
   - В Phase 0 — мінімум lint + type-check; повний test suite — Phase 1.
3. **Rollback**: через Vercel UI ("Promote to Production" попередньої версії). Без додаткової інфраструктури.
4. **Production deploy не блокується** failing GitHub Actions у MVP (single developer, "rough edges" толеруються). Якщо стане частих неробочих релізів — додамо required check на main у Phase 1.
5. **Гілки**: trunk-based на `main`. Feature branches для preview deploy і review. Без long-lived release branches.

**Альтернативи:**

- **GitHub Actions → SSH/rsync на VPS** (як для VPS-варіанту). Відкинуто разом з VPS-хостингом (D-034) на користь Vercel.
- **Docker-based deploy** (build image → push → pull). Відкинуто: Vercel сам управляє build і runtime, додатковий шар Docker не дає виграшу для Next.js.
- **Manual deploy зі своєї машини.** Відкинуто: GitHub Actions безкоштовні для приватних репо в ліміті, auto-deploy на Vercel — нативний, ціна = 0 додаткових налаштувань.

**Обґрунтування:**

- Vercel GitHub Integration — zero-config CI/CD для Next.js. Виправлений flow, описаний у тисячах прикладів — менше шансів на власні баги в pipeline.
- Preview deploy на кожен PR — суттєво полегшує UI-review (адмін бачить реальну сторінку до merge).
- GitHub Actions для тестів — стандартний шлях для React/Next.js екосистеми.

**Наслідки:**

- В PRD 10.5 фіксується цей flow.
- В репо потрібен `.github/workflows/ci.yml` з lint + type-check.
- В Vercel UI підключається GitHub repo, виставляється production branch = `main`.
- Secrets (`PRIVATBANK_TOKEN`, `DUBIDOC_TOKEN`, `MOEOSBB_DB_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH`, `SESSION_SECRET`) керуються через `vercel env` (preview/development/production окремо). GitHub Actions secrets — тільки для тестових fixtures, якщо потрібно (не для production credentials).

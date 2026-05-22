# D-037 — Quality gates stack: oxlint + prettier + vitest + qa-verify + Claude Code hooks + Real behavior proof

**Дата:** 2026-05-22

**Переглядає:** [D-035](D-035-cicd.md) — лише в частині tooling-стека (пункт 2: lint/type-check/test). Решта D-035 (Vercel auto-deploy, rollback через "Promote to Production", trunk-based на `main`, prod deploy не блокується failing CI у MVP) залишається чинною.

**Рішення:**

1. **Linter:** `oxlint` (Rust-based) замість ESLint.
   - ESLint і `eslint-config-next` повністю видалено з `devDependencies`; `eslint.config.mjs` видалено.
   - `npm run lint` → `oxlint` (default `correctness` category).
   - `npm run lint:fix` → `oxlint --fix`.
2. **Formatter:** Prettier 3, з конфігом у `.prettierrc` (semi, double quotes, `trailingComma: all`, `printWidth: 100`, `arrowParens: always`, `endOfLine: lf`) і `.prettierignore` для зовнішніх артефактів (`.claude/commands`, `.claude/skills`, `docs/api-docs`, `openspec/changes/archive`, lockfiles, build outputs).
   - `npm run format` → `prettier --write .`
   - `npm run format:check` → `prettier --check .`
3. **Typecheck:** `tsc --noEmit` через `npm run typecheck`. Незмінно.
4. **Unit tests:** **Vitest 3** з jsdom + `@testing-library/react` + `@testing-library/jest-dom`.
   - Конфіг: `vitest.config.ts` (React plugin, `@/*` alias, setup file).
   - `npm run test` (watch), `npm run test:run` (single pass для CI/гейтів).
   - Тести у `tests/` (`unit/`, далі `integration/`, `e2e/` по мірі додавання).
   - Це **підсилює D-035 пункт 2.4**: unit-тести вмикаються в bundle gate з Phase 0, а не з Phase 1 (повний integration/E2E suite — все ще Phase 1+, додаємо разом з відповідними capabilities).
5. **Bundle gate:** `scripts/qa-verify.mjs` (`npm run qa`) — атомарний ритуал перед archive / PR:
   `lint → format:check → typecheck → test:run → build → openspec validate --all --strict`.
   Fail-fast: перший non-zero exit → весь ритуал failed. Запускається локально, через Claude Code Stop hook і в CI.
6. **Claude Code hooks** (`.claude/settings.json` + `.claude/hooks/*.sh`):
   - **PostToolUse** (`Edit|Write|MultiEdit`): `format-lint.sh` запускає prettier + oxlint на змінений файл. Format не може бути забутий.
   - **Stop**: `stop-gate.sh` запускає typecheck + `vitest --bail=1`. Якщо fail — агент продовжує, а не оголошує "done".
   - **PreToolUse** (`Bash`): `block-dangerous-bash.sh` блокує `rm -rf` на root/home/wildcards, `git push --force`/`-f`, `git reset --hard`, `git clean -f`, `chmod 777`.
7. **CI workflow:** `.github/workflows/ai-pr-check.yml` на `pull_request → main`, два jobs:
   - **`static-gates`** (`ubuntu-latest`, Node 22, `npm ci`): lint, format:check, typecheck, test:run.
   - **`real-behavior-proof`** (`actions/github-script@v7`): валідує, що PR body містить непорожню секцію `## Real behavior proof` з recording/screenshot/link. JS-контекст без shell-інтерполяції — нема injection-ризику від untrusted PR body.
8. **PR template:** `.github/PULL_REQUEST_TEMPLATE.md` з обов'язковими секціями: Summary, Linked artifacts (OpenSpec change, capability slice, FR-ID, ADR), **Real behavior proof** (Demo recording, Reproduction steps, Verification log), QA checklist, Risks/rollback.
9. **Traceability matrix:** `docs/qa/traceability-matrix.md` — таблиця FR ID → Capability → Spec → Test → Demo recording. Оновлюється у DoD кожного capability slice (узгоджено з `docs/mvp-capability-plan.md § 6`).

**Альтернативи:**

- **Залишити ESLint поруч з oxlint** (oxlint як швидкий precommit, ESLint для Next-специфічних правил). Відкинуто: подвійна підтримка конфігів, повільніший feedback loop; ціна — втрата деяких Next-специфічних правил (`next/no-img-element` тощо) — приймаємо, бо `tsc --noEmit` + Next build уже ловлять більшість серйозних проблем, а решту покриває code review.
- **Husky + lint-staged замість Claude Code hooks.** Відкинуто (для AI-агентного workflow): Claude Code hooks спрацьовують негайно після Edit/Write навіть без коміту і не вимагають окремої CLI-залежності. Git hooks можна додати окремо для людей-контрибʼюторів, якщо коли з'являться (зараз single-developer).
- **Jest замість Vitest.** Відкинуто: Vitest — нативний ESM, миттєвий старт, спільна конфіг-екосистема з Vite/Turbopack; для React 19 + Next 16 — кращий fit.
- **Playwright/integration з real DB одразу.** Відкинуто на цій ітерації: DB ще не сконфігуровано (D-024 → потребує S0 setup), capabilities не реалізовані. Додамо разом з S2+ (clients) як integration smoke, з S1+ — Playwright E2E на 3-5 critical paths (узгоджено з `docs/mvp-capability-plan.md § 1` і workshop checklist зі слайду 10).
- **Lighthouse CI / bundle-size gates.** Відкинуто на цій ітерації — додамо у Phase 1 polish (узгоджено з workshop checklist пунктом "Performance: bundle-size + Lighthouse CI").

**Обґрунтування:**

- **AI-агент пише код за принципом "зліва направо" по verification pyramid** (типи → unit → integration → E2E → real behavior). Bundle gate автоматизує цей ритуал — агент не може "забути" жодного рівня.
- **Hooks як policy infrastructure:** прибирають з агента можливість оголосити роботу завершеною, поки fast static gates не зелені. Це гарантія, що жоден stop не залишає baseline у failing state.
- **Real behavior proof у PR body — обовʼязковий артефакт** для capability slice (узгоджено з `docs/mvp-capability-plan.md § 6` Definition of Done і workshop slide 4): рев'юер бачить не тільки "тести зелені", але й як саме воно працює.
- **oxlint** дає 50-100× швидший feedback (Rust vs JS), що критично для PostToolUse-хука на кожен Edit/Write.
- **Atomic qa-verify** запобігає частковому archive: коли OpenSpec change архівується, всі gates мають бути зелені одночасно, не "lint passed days ago + tests passed yesterday".

**Наслідки:**

- `docs/adr/D-035-cicd.md` пункт 2 ("lint: eslint, prettier check") тепер історичний контекст — фактичний tooling описаний у цьому ADR.
- `.github/workflows/ci.yml` (як планувалось у D-035 "Наслідки") **не створюється** — його заміняє `.github/workflows/ai-pr-check.yml` з розширеним scope (static-gates + real-behavior-proof).
- Будь-яка нова capability-зміна після цього ADR проходить через `npm run qa` локально (через Stop hook автоматично) і `ai-pr-check.yml` у CI перед merge.
- Документація `docs/qa/traceability-matrix.md` стає частиною Definition of Done кожного capability slice (узгоджено з `docs/mvp-capability-plan.md § 6`).
- Cross-cutting infra-change без OpenSpec proposal — узгоджено з `docs/mvp-capability-plan.md § 2` (тип concern "Каркас, naming, гайдрейли → Без OpenSpec у Phase 0 setup").

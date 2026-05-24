<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

## First-time setup (human, one-off)

Перед першим деплоєм або pull env-змінних — користувач (не агент) має виконати інтерактивно:

```bash
nvm use                                  # Node 22, з .nvmrc
npm install                              # тільки якщо ще не зроблено
npx vercel login                         # один раз на машину
npx vercel link                          # привʼязати локальний проект до Vercel-проекту
npx vercel env pull .env.local --yes     # підтягнути POSTGRES_URL, BLOB_READ_WRITE_TOKEN і ін.
```

Інші ENV-змінні з [`NFR-SEC-02`](docs/prd.md) (PRIVATBANK_TOKEN, DUBIDOC_TOKEN, MOEOSBB_DB_URL,
ADMIN_EMAIL, ADMIN_PASSWORD_HASH, SESSION_SECRET) — додаються через `vercel env add` для
development/preview/production окремо. Шаблон у [`.env.example`](.env.example).

Згенерувати auth-секрети локально перед `vercel env add`:

```bash
printf 'your-password' | node scripts/hash-password.mjs   # ADMIN_PASSWORD_HASH (argon2id)
openssl rand -base64 48                                   # SESSION_SECRET (≥ 32 байти ентропії)
```

Агент не може виконати ці кроки самостійно (інтерактивні prompts).

## Requirements

Use docs/prd.md to understand the product requirements.

## Project Handoff Protocol

Before planning or implementing any substantive change, read:

1. docs/current-state.md — поточний стан і next-step guidance
2. docs/mvp-capability-plan.md — MVP change sequence
3. openspec/project.md — project context
4. openspec/specs/<capability> — current accepted behavior
5. docs/adr/ — accepted architecture decisions

## Architecture (hard import boundaries)

- app/ MUST NOT import from app/api/internals/
- lib/ MUST be pure (no Next.js imports)
- New capability lives in app/(capability)/<name>/

## Quality gates (D-037)

Локальний ритуал перед `openspec archive` / PR:

```bash
npm run qa     # lint → format:check → typecheck → test:run → build → openspec validate
```

Те саме крутиться у Stop hook (`.claude/hooks/stop-gate.sh`) і у CI
(`.github/workflows/ai-pr-check.yml`). Атомарно — перший fail зупиняє ритуал.

**PR body МАЄ містити секцію `## Real behavior proof`** (template в `.github/PULL_REQUEST_TEMPLATE.md`)
з одним з:

- screenshot (через Chrome DevTools MCP) або link на attachment;
- verification log — fenced code block з ≥ 3 непорожніх рядків (curl/fetch + DB state changes);
- Playwright trace/video (від S2+, коли налаштовано).

## Тести

- **Unit (Vitest + happy-dom):** `tests/unit/<domain>/*.test.ts` — чисті функції, схеми Zod, branded-types.
- **Integration smoke (з S2+):** `tests/integration/<capability>/*.smoke.ts` — реальна Neon test-БД через Drizzle (D-038), без mock-ів.
- **E2E (Playwright, з S2+):** `tests/e2e/*.spec.ts` — 3-5 critical paths.
- **HTTP-моки зовнішніх API:** MSW через `tests/mocks/handlers/<provider>.ts` (D-039). НЕ використовувати inline `vi.mock` на fetch.
- **DB:** не мокати — реальна test-БД (Neon branch). MoeOSBB MySQL мокується на рівні сервісного шару (`lib/external-apis/moeosbb/`).

## UI / Design system

DESIGN.md (project root) is the **authoritative design system** for all UI work — colors, typography, spacing, components, patterns. Before building or modifying any UI surface (page, component, layout, form, chart, badge), read it and reuse its tokens and patterns verbatim.

- Take colors from `colors.*` (e.g. `colors.primary`, `colors.brand-navy`, `colors.semantic-success`). Do NOT introduce hex literals or ad-hoc Tailwind shades.
- Take typography from the `typography.*` scale (e.g. `body-md`, `heading-2`). Do NOT invent new sizes/weights.
- Reuse component specs and interaction patterns described in DESIGN.md instead of guessing from memory or copying generic shadcn examples.
- If a UI need isn't covered by DESIGN.md, propose an extension in chat (and capture it as a new entry in DESIGN.md) — do not silently invent a token.

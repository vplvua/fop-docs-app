# Project Context — fop-docs-app

Internal accounting + auto-generation of work-completion acts for a single
Ukrainian FOP (ФОП — приватний підприємець). Replaces the manual workflow
behind acts for the "access service" tariff billed to OSBB customers.

Single admin user (no multi-tenancy, no team). Operator interacts with the
system in Ukrainian.

---

## Domain primer

Core entities and their relationships are spec-driven (see
[`openspec/specs/`](specs/) once populated). The shape today:

- **Client** — OSBB or company. Optional link to a row in the external
  "Моє ОСББ" MySQL DB via `moeosbb_user_id`. Admin-only fields:
  `apartments_count`, `access_price_override`, `auto_act_disabled`,
  `edo_provider`.
- **Contract** — 0..1 per client. Stores `signed_date`, optional `file_url`.
- **Payment** — ingested from PrivatBank Автоклієнт API; goes through a
  classifier into one of: `classified`, `awaiting_review`, `in_queue` (with a
  `classification_reason`).
- **Act** — work-completion act. **Immutable after creation** (BC-LEGAL-05):
  fields are snapshots taken from Client/Contract/Tariff at issuance time.
  Numbered per `(client_id, year, month)` under `FOR UPDATE`.
- **Tariff / SmsPrice** — access-service price grid with ranged rules,
  per-client overrides, and a mandatory catch-all. SMS price is versioned by
  `effective_from`.
- **integration_health** — per-service liveness ledger (`privatbank`,
  `dubidoc`, `moeosbb`); written by every cron handler, read by the dashboard.

PRD with FR / NFR / TC / BC identifiers lives in [`docs/prd.md`](../docs/prd.md).
PRD rationale and edge-case worked examples: [`docs/prd-rationale.md`](../docs/prd-rationale.md).

---

## Tech stack (Phase 0 baseline)

- **Runtime:** Node.js 22 LTS (see `.nvmrc`, `engines.node`).
- **Framework:** Next.js 16 (App Router, Turbopack). **Note:** Next 16
  renames `middleware.ts` → `proxy.ts`. Read the relevant guide in
  `node_modules/next/dist/docs/` before writing routing code — APIs differ
  from training data.
- **UI:** React 19, Tailwind CSS 4 (oklch tokens), shadcn/ui + `@base-ui/react`,
  `lucide-react`, `class-variance-authority`, `tailwind-merge`,
  `tw-animate-css`.
- **Design system:** [`DESIGN.md`](../DESIGN.md) is authoritative — Notion-
  inspired tokens (`colors.*`, `typography.*`). **No hex literals, no
  ad-hoc Tailwind shades** outside of token mapping.
- **Validation:** Zod 4 (`zod`) with branded types where identity matters.
- **Data layer:** Drizzle ORM (`drizzle-orm/neon-http`) over Postgres on Neon
  (Vercel Marketplace integration). Schema-first in `lib/db/schema/*.ts`.
  Migrations checked-in under `lib/db/migrations/` (`drizzle-kit generate` /
  `drizzle-kit migrate`). HTTP driver = no `db.transaction()`; switch to
  `neon-serverless` Pool when transactions land (S6/S8).
- **External:** PrivatBank Автоклієнт (S6), Дубідок Premium (S9), MoeOSBB
  read-only MySQL (S11), Vchasno (manual external flow, S10).
- **Hosting:** Vercel (Fluid Compute, Node 22). `vercel.ts` via
  `@vercel/config/v1` (replaces `vercel.json`). Crons registered per slice.
- **Logging:** `pino` (JSON) with redact paths covering every secret in
  `.env.example`. `LOG_LEVEL` env (debug in dev, info in prod).
- **Tests:** Vitest + happy-dom (unit), MSW for HTTP mocks (D-039), Drizzle
  - Neon test branch for integration smoke (D-038), Playwright for E2E
    (added with S2+).
- **Quality gates:** oxlint (correctness/suspicious/perf as error;
  pedantic as warn; plugins: typescript/unicorn/oxc/react/react-perf/
  jsx-a11y/nextjs/import/promise), Prettier 3, `tsc --noEmit` with
  `strict + noUncheckedIndexedAccess + exactOptionalPropertyTypes`.
- **CI:** `.github/workflows/ai-pr-check.yml` runs the same `qa-verify.mjs`
  pipeline + enforces a "Real behavior proof" section in every PR body.

---

## Architecture conventions

Hard import boundaries (enforced by `.oxlintrc.json`):

- `app/` MUST NOT import from `app/api/internals/`.
- `lib/` MUST stay pure — no Next.js imports (`next`, `next/*`,
  `next/server`). Server-only-ness is enforced at the call site (route
  handlers, server actions, proxy.ts), not inside `lib/`.
- New capability code lives in `app/(<capability>)/<name>/` (route group).

`lib/` shape (some empty until their slice — see each folder's README.md):

- `lib/db/` — Drizzle client + schema + migrations (live).
- `lib/logging/` — pino logger (live).
- `lib/observability/` — `integration_health` writers/readers (live).
- `lib/auth/` — sessions, argon2id, rate-limit (S1).
- `lib/blob/` — Vercel Blob wrapper for act PDFs (S8).
- `lib/pdf/` — React + Tailwind → headless Chromium via
  `@sparticuz/chromium` (S8).
- `lib/external-apis/{privatbank,dubidoc,moeosbb}/` — provider HTTP/MySQL
  clients (S6 / S9 / S11).
- `lib/i18n/` — placeholder for future locales; MVP is UA-only.

---

## Workflow

Phase 0 (MVP) is sliced into capability slices S1..S13 — vertical
UI → API → Domain → DB → Tests → Docs cuts that each fit one PR with one
demo recording. Dependency graph and per-slice scope in
[`docs/mvp-capability-plan.md`](../docs/mvp-capability-plan.md).

**PR := capability := demo recording := `current-state.md` update.** If a
slice doesn't fit one PR, cut it further.

For each slice (S1+) the cycle is:

1. `/opsx:explore` — only when scope is unclear or a TBD is open.
2. `/opsx:propose add-<slice>` — creates `proposal.md`, `design.md`,
   `tasks.md`, `specs/<capability>/spec.md` (delta).
3. `/opsx:apply add-<slice>` — implementation loop through `tasks.md`.
4. `npm run qa` — 6/6 gates must be green before archive (lint, format,
   typecheck, test, build, openspec validate).
5. Demo recording → [`docs/qa/recordings/`](../docs/qa/recordings/).
6. Update [`docs/current-state.md`](../docs/current-state.md) (Phase,
   last/next slice, capability matrix, recent activity).
7. `/opsx:archive add-<slice>` — sync delta-spec to main, move to
   `openspec/changes/archive/YYYY-MM-DD-<name>/`.
8. Commit + PR. PR body MUST include `## Real behavior proof` section
   (template at `.github/PULL_REQUEST_TEMPLATE.md`).

Phase 0 setup (S0) was the bootstrap — no OpenSpec change required.

---

## Non-negotiable constraints

- **Single admin.** No RBAC, no multi-tenancy. Email + argon2id password +
  HMAC session cookie. IP rate-limit 10 login attempts/hour.
- **UA-only UI** at MVP. All operator-facing copy in Ukrainian; i18n
  scaffold lives in `lib/i18n/` for Phase 1+.
- **Act immutability** (BC-LEGAL-05). Once an Act row exists, snapshots
  are frozen. Re-issuing produces a new act with a new number.
- **One payment ↔ one act** (D-007). No bundling, no split.
- **Catch-all tariff invariant** (D-018). Deletion of the only catch-all
  tariff must be blocked at the domain layer.
- **FK ON DELETE RESTRICT** on Client/Contract/Payment/Act chain (D-025).
  Soft-archive only, never hard delete history.
- **No HTTP-fetch mocks via inline `vi.mock`.** Use MSW handlers in
  `tests/mocks/handlers/<provider>.ts` (D-039).
- **No mocked DB.** Integration smoke runs against a real Neon branch
  (D-038). MoeOSBB MySQL is mocked at the service layer only.

---

## Source of truth, in priority order

1. `openspec/specs/<capability>/spec.md` — accepted behavior (after archive).
2. `openspec/changes/<name>/` — in-flight proposals overriding specs for the
   duration of the change.
3. [`docs/prd.md`](../docs/prd.md) — FR / NFR / TC / BC IDs.
4. [`docs/adr/`](../docs/adr/) — architecture decisions (D-001..D-039 today).
5. [`docs/mvp-capability-plan.md`](../docs/mvp-capability-plan.md) —
   slicing, dependency graph, per-slice scope.
6. [`docs/current-state.md`](../docs/current-state.md) — what's done /
   in-flight / blocked right now.
7. [`AGENTS.md`](../AGENTS.md) / [`CLAUDE.md`](../CLAUDE.md) — agent
   operating rules (import boundaries, quality gates, first-time setup).

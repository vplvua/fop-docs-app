# Current State

**Останнє оновлення:** 2026-05-22
**Призначення:** snapshot фактичної готовності системи. Оновлюється у Definition-of-Done кожного capability slice ([`mvp-capability-plan.md § 6`](mvp-capability-plan.md)).

---

## Phase

`Phase 0 — MVP (not started)`

## Last completed slice

`—` (нічого не змерджено)

## Next slice

`Phase 0 setup` (bootstrap, не capability — див. [`mvp-capability-plan.md § 4`](mvp-capability-plan.md))

Після Phase 0 setup — `S1. auth` (див. [`mvp-capability-plan.md § 5`](mvp-capability-plan.md)).

## Blockers

Жодних поточних блокерів. Відкриті TBD-питання, які прояснюються до відкриття відповідного зрізу — у [`mvp-capability-plan.md § 7`](mvp-capability-plan.md):

- `TBD-S6-1` — sandbox для PrivatBank API (стане блокером перед S6).
- `TBD-S8-1` — Chromium cold-start на Vercel Function (стане блокером перед S8).
- `TBD-S9-1` — sandbox-токен Дубідок Premium (стане блокером перед S9).
- `TBD-S11-1` — мережевий доступ з Vercel у приватний MySQL "Моє ОСББ" (стане блокером перед S11).

## Capability completion matrix

| ID  | Slice                | Status      | PR  | Demo recording |
| --- | -------------------- | ----------- | --- | -------------- |
| S0  | Phase 0 setup        | not started | —   | —              |
| S1  | auth                 | not started | —   | —              |
| S2  | clients              | not started | —   | —              |
| S3  | contracts            | not started | —   | —              |
| S4  | tariffs              | not started | —   | —              |
| S5  | settings             | not started | —   | —              |
| S6  | payments-ingest      | not started | —   | —              |
| S7  | classification       | not started | —   | —              |
| S8  | acts                 | not started | —   | —              |
| S9  | edo-dubidoc          | not started | —   | —              |
| S10 | edo-vchasno-external | not started | —   | —              |
| S11 | moeosbb-sync         | not started | —   | —              |
| S12 | queue (polish)       | not started | —   | —              |
| S13 | dashboard (polish)   | not started | —   | —              |

Статуси: `not started` / `in progress` / `done` / `blocked`.

## Recent activity

- `2026-05-22` — Severity 1+2 закриття перед S0: pin Node 22 (`.nvmrc` + `engines`), `.env.example` зі всіма ENV з NFR-SEC-02, hardening хуків (jq hard-dep check), `.editorconfig`, `.oxlintrc.json` (correctness+suspicious+perf як error, pedantic як warn, плагіни react/jsx-a11y/nextjs/import/promise), strict TS прапори (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`), jsdom→happy-dom + `@vitest/coverage-v8` з 70% threshold на lib/+components/, RBP regex приймає screenshot OR verification log, `AGENTS.md` оновлено: first-time setup для людини (`vercel link` / `env pull`) + Quality gates + Тести.
- `2026-05-22` — Прийнято [D-038](adr/D-038-drizzle-orm.md) (Drizzle ORM, відкладена інсталяція до S0) і [D-039](adr/D-039-test-http-mocks.md) (MSW як єдина стратегія HTTP-моків, відкладена інсталяція до S6). `tests/mocks/README.md` фіксує convention.
- `2026-05-22` — Quality gates stack: oxlint (eslint видалено), Prettier, Vitest, `scripts/qa-verify.mjs`, Claude Code hooks (PostToolUse/Stop/PreToolUse), `.github/workflows/ai-pr-check.yml` (static-gates + real-behavior-proof), PR template, `docs/qa/traceability-matrix.md`. Зафіксовано в [D-037](adr/D-037-quality-gates-stack.md) (переглядає [D-035](adr/D-035-cicd.md) в частині tooling).
- `2026-05-22` — Створено `docs/mvp-capability-plan.md`, `docs/current-state.md`, `docs/qa/recordings/`.
- `2026-05-22` — Перенесено ADR і референс-документацію з `fop-docs/research/` у `docs/`.
- `2026-05-21` — Створено `docs/prd.md` (структурована форма FR/NFR/TC/BC).

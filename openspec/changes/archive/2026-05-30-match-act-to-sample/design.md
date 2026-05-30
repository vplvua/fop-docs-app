## Context

Act PDFs are rendered by `lib/pdf/act-template.tsx` using `@react-pdf/renderer` (ADR D-028/D-040 — the `acts` spec text still says "headless Chromium" and is stale). The current output is a table form; the reference acts clients received (`docs/samples/acts/act-2026-04_200.pdf`, `act-2026-04_2000.pdf`) are a narrative form. The executor (FOP) details come from `FOP_*` env vars read live at render in `lib/pdf/render.ts:getFopDetails()`. Act numbers (`№4` / `№4/2`) are produced by duplicated logic in `lib/acts/numbering.ts:formatActNumber` and `lib/classification/act-stub.ts:generateActNumber`. Service descriptions are built in `lib/classification/act-stub.ts:buildServiceDescription`. Acts already store immutable `client_snapshot` / `contract_snapshot` (jsonb) but read FOP details live.

Infrastructure that already exists and is reused: a generic key-value `settings` table (`lib/db/schema/settings.ts`) with `getSettingValue`/`setSettingValue` helpers (`lib/settings`), and a settings-page pattern (`page.tsx` + `actions.ts` + `action-state.ts` + form) with a shared `SETTINGS_NAV` in `app/(settings)/settings/layout.tsx`.

Constraints: `lib/` must be pure (no Next.js imports); PDF stays on `@react-pdf/renderer` (no headless browser); migrations hit dev and prod Neon branches separately (`docs/operations.md`); `npm run qa` must pass (D-037).

## Goals / Non-Goals

**Goals:**

- New acts are visually indistinguishable from the sample PDFs (narrative form).
- FOP requisites are admin-editable in Settings, not env-bound, and frozen onto each act for legal immutability.
- Act number, service wording, and amount-in-words match the samples.
- Existing acts are brought to the new format.

**Non-Goals:**

- Multi-FOP support (single executor profile only).
- Changing EDO send/poll, Blob storage, or download flows.
- Reproducing every sample detail — three deviations are intentional (one bank account, no postal address, no client phone/email).
- Changing the act-date rule (last day of payment month, ADR D-006) or the race-safe numbering mechanism (`SELECT ... FOR UPDATE`).

## Decisions

### D1: Requisites stored in `settings` under `fop_requisites`, not a new table

The `settings` table is a generic key-value jsonb store already used for intervals, SMS prices, etc. A new `requisites` capability owns the `fop_requisites` key, a Zod schema (`lib/requisites/schema.ts`), and typed accessors over `getSettingValue`/`setSettingValue`. Alternative (dedicated table) rejected: a singleton table adds a migration and a bespoke access path for no benefit over the existing pattern.

Fields: `nameNominative`, `nameGenitive`, `ipn`, `legalAddress`, `bankAccount`, `bankName`, `taxNote`, `phone`, `email`, `city`.

### D2: Name strings are stored verbatim — no prefix hardcoding

`nameNominative` holds the full requisites-header text (e.g. `ФІЗИЧНА ОСОБА-ПІДПРИЄМЕЦЬ ПАШКО ВАСИЛЬ ТЕОДОЗІЙОВИЧ`) and `nameGenitive` holds the full preamble phrase (e.g. `фізичної особи-підприємця Пашка Василя Теодозійовича`). The template renders them as-is — no `toUpperCase()`, no concatenated fixed prefixes. Rationale: the admin can adjust exact wording/casing without code changes; uppercasing in code would also mangle the «» / apostrophes.

### D3: FOP snapshot on the act (immutability), parallel to client/contract snapshots

Add `acts.fop_snapshot` (jsonb). At act-stub creation, the current `fop_requisites` is copied into `fop_snapshot`. The PDF renders the executor block from `fop_snapshot`, never from live settings. Rationale: a legal document must not retroactively change when the admin later edits requisites — consistent with `client_snapshot` / `contract_snapshot`. Live-read alternative rejected: editing requisites would silently alter already-issued acts on regeneration.

### D4: Act number format `MM/YYYY` with optional `/N`

First act in a month → `MM/YYYY` (zero-padded month, year from `act_date`); subsequent → `MM/YYYY/N`. Both `lib/acts/numbering.ts:formatActNumber` and `lib/classification/act-stub.ts:generateActNumber` (duplicated logic) are updated to take the year and produce this format. The `(client_id, act_date, number)` UNIQUE index and `FOR UPDATE` serialization are unchanged. ADR D-005 is updated. The PDF heading prints `АКТ {number}` verbatim, so the heading follows automatically.

### D5: Fixed service descriptions, integer quantity, unit always «шт.»

`buildServiceDescription` returns `Надання доступу до сервісу "Моє ОСББ" (один календарний місяць)` for `access` and `Інтернет послуги (розсилка повідомлень)` for `sms`, with no embedded quantity. `quantity_unit` is always `шт.`. Quantity renders as an integer (`1`, `2`, `250`) — formatted at render, storage stays `numeric`. The service line is composed in the template as `{description}, {qty} шт. – {sum} грн.`.

### D6: Amount-in-words as a pure helper

New `lib/money/uah-in-words.ts` converts the hryvnia integer part to Ukrainian words with feminine гривня declension (`одна гривня` / `дві гривні` / `двісті гривень` / `дві тисячі гривень`) and appends kopecks as two digits + `коп.` (e.g. `двісті гривень 00 коп.`). Pure, no Next imports, unit-tested. The template uses it for `Загальна вартість робіт (послуг) без ПДВ {sum} грн. ({words}), ПДВ 0.00 грн.`.

### D7: Template rebuilt as a single narrative layout

`act-template.tsx` is rewritten with `@react-pdf/renderer` primitives: two-line centered heading **(regular weight, not bold)** (`АКТ {number}` + `здачі-приймання робіт (надання послуг)`), a place/date row (`{city}` rendered verbatim left, `DD.MM.YYYY` right), a justified preamble paragraph (ОСББ name bold, `nameGenitive` inline, contract № + date), the service line, the total-in-words line, `Сторони претензій одна до одної не мають.`, and a bordered two-column requisites table (`Від Виконавця` / `Від Замовника`, a spacer row, then requisite lines). Signature underlines and the `ст. 297 ПКУ` note are removed. Executor block: `nameNominative`, `ІПН {ipn}`, `Юридична адреса: {legalAddress}`, `Поточний рахунок: {bankAccount} в {bankName}`, `{taxNote}`, `Тел.: {phone}`, `Електронна адреса: {email}`. Client block: name (bold), `Код ЄДРПОУ: {legalId}`, `Юридична адреса: {address}`, `Поточний рахунок: {bankAccount} в {bankName}`.

The `city` field is rendered verbatim (no hardcoded `м.` prefix), consistent with the verbatim-name decision (D2) — the admin stores the full place string (e.g. `м. Львів`). This avoids the double-prefix bug (`м.м. Львів`) when the stored value already includes `м.`.

### D10: Fonts embedded as base64, not loaded from a CDN

The act uses **DejaVu Sans** (regular + bold) to match the sans-serif look of the client samples (the earlier Times choice was a deviation). The font bytes are embedded as base64 `data:` URLs in `lib/pdf/fonts/*.ts` and registered via `Font.register` — `@react-pdf/font` decodes `data:` URLs in-process. Rationale: the previous CDN URL (jsdelivr) made every PDF render depend on network availability and added cold-start latency / a failure mode. Embedding makes rendering fully offline and deployment-robust: the bytes ride the normal module graph into exactly the serverless functions that import the template, with no `outputFileTracingIncludes` configuration or filesystem path resolution to get wrong. Trade-off: ~1.9 MB of base64 across two committed modules (excluded from prettier/oxlint). Alternatives rejected: CDN `src` (network dependency), local `.ttf` + `fontkit.open` path (fragile per-route file tracing on Vercel). A future optimization could subset the font to the glyphs actually used (~30–50 KB).

### D8: Intentional deviations from the samples (recorded)

One executor bank account (samples show two), no postal address (samples show `а/с 631`), no client phone/email in the Замовник block (samples show them). These are product decisions, documented so a future reader does not "correct" the template back toward the sample.

### D9: Mass regeneration is a one-off admin/script action

A script (or admin action) iterates all acts, recomputes `service_description` from `service_type` (so legacy descriptions like `"Доступ до сервісу за період 1 міс."` adopt the current fixed wording), builds `fop_snapshot` from current requisites where missing, re-renders via the new template, and updates `pdf_file_url`. Idempotent (safe to re-run). Not wired into a cron. The description recompute overwrites any manual edits — accepted by the user (few acts, verified by hand). Note: making the service name admin-configurable (near Тарифи / Ціни СМС) is deferred to a separate follow-up change; re-running regeneration afterward will pick up the configured names.

## Risks / Trade-offs

- **Mass regeneration touches acts already sent to / signed in EDO** → Accepted by the user. Mitigation: run once after deploy + prod migration; the regenerated PDF is byte-stable for unchanged data, so re-running is safe; EDO documents already submitted are not re-sent (regeneration only updates the local PDF/Blob).
- **`fop_snapshot` is NOT NULL going forward but absent on old rows** → add the column nullable; backfill during mass regeneration; renderer falls back to live requisites only for rows lacking a snapshot during the transition.
- **Empty / unconfigured requisites at first render** → the Zod schema requires all fields; if `fop_requisites` is unset, act PDF generation fails loudly (act stays `draft`, regen later) rather than emitting a blank executor block. Surface a clear empty-state on `/settings/requisites`.
- **Duplicated numbering logic in two files** → both updated in this change; a follow-up could de-duplicate, but consolidating is out of scope here to keep the diff focused.
- **Dev vs prod migration drift** → `npm run db:migrate` only touches dev; prod `acts.fop_snapshot` must be migrated separately per `docs/operations.md` before prod regeneration.

## Migration Plan

1. Add `acts.fop_snapshot` (jsonb, nullable) — Drizzle migration on dev branch.
2. Ship requisites schema + accessors + `/settings/requisites` admin page; populate `fop_requisites`.
3. Update numbering, service descriptions, snapshot-on-create, and the template.
4. Deploy; migrate the prod Neon branch separately.
5. Run mass regeneration once (backfills `fop_snapshot`, re-renders PDFs).
6. Remove `FOP_*` env vars from `.env.example` and the `AGENTS.md` Slice 8 note; update ADR D-005.

Rollback: revert the deploy; the new `fop_snapshot` column is additive and harmless if unused. Regenerated PDFs of unchanged data are equivalent to re-running the old template only in layout — a full rollback would require restoring prior Blob PDFs (out of scope; low risk given acts are reproducible from snapshots).

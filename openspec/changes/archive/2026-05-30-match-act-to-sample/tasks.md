## 1. Requisites storage & schema (capability: requisites)

- [x] 1.1 Create `lib/requisites/schema.ts` — Zod schema with required, non-empty fields: `nameNominative`, `nameGenitive`, `ipn`, `legalAddress`, `bankAccount`, `bankName`, `taxNote`, `phone`, `email`, `city` (keep pure, no Next imports)
- [x] 1.2 Create `lib/requisites/index.ts` — `getFopRequisites()` / `setFopRequisites()` over `getSettingValue`/`setSettingValue` with key `fop_requisites`, validating via the schema; export the inferred `FopRequisites` type
- [x] 1.3 Add unit tests `tests/unit/requisites/schema.test.ts` — valid object passes; missing/empty field fails

## 2. FOP snapshot column (DB)

- [x] 2.1 Add `fopSnapshot` (jsonb, nullable) to `lib/db/schema/acts.ts`; export updated `Act` type
- [ ] 2.2 Generate Drizzle migration and run `npm run db:migrate` on the dev Neon branch
- [x] 2.3 Note in the PR/runbook that the prod Neon branch must be migrated separately per `docs/operations.md`

## 3. Admin Settings → Реквізити page (capability: requisites)

- [x] 3.1 Add `{ href: "/settings/requisites", label: "Реквізити" }` to `SETTINGS_NAV` in `app/(settings)/settings/layout.tsx`
- [x] 3.2 Create `app/(settings)/settings/requisites/action-state.ts` and `actions.ts` (save action that validates + persists via `lib/requisites`, with `revalidatePath`), mirroring `integrations/`
- [x] 3.3 Create `app/(settings)/settings/requisites/requisites-form.tsx` — fields for all 10 values, DESIGN.md tokens/typography, success + field-error states, empty state when unset
- [x] 3.4 Create `app/(settings)/settings/requisites/page.tsx` — load current requisites and render the form

## 4. Amount in words (capability: acts)

- [x] 4.1 Create `lib/money/uah-in-words.ts` — hryvnia integer part to Ukrainian words with feminine гривня declension; kopecks as two digits + `коп.` (pure, no Next imports)
- [x] 4.2 Add `tests/unit/money/uah-in-words.test.ts` — `1 → одна гривня 00 коп.`, `200 → двісті гривень 00 коп.`, `2000 → дві тисячі гривень 00 коп.`, plus kopecks (e.g. `200.50`)

## 5. Act number format (capabilities: acts, classification)

- [x] 5.1 Update `lib/acts/numbering.ts:formatActNumber` to take the year and produce `MM/YYYY` (first) / `MM/YYYY/N` (subsequent), zero-padded month, no `№`
- [x] 5.2 Update `lib/classification/act-stub.ts:generateActNumber` to the same `MM/YYYY[/N]` format (duplicated logic — keep both in sync)
- [x] 5.3 Update/extend numbering unit tests for the new format

## 6. Service descriptions & quantity (capability: classification)

- [x] 6.1 Update `lib/classification/act-stub.ts:buildServiceDescription` — `access` → `Надання доступу до сервісу "Моє ОСББ" (один календарний місяць)`, `sms` → `Інтернет послуги (розсилка повідомлень)`, no embedded quantity
- [x] 6.2 Ensure `quantity_unit` is always set to `шт.` at act-stub creation

## 7. Snapshot requisites on act creation (capability: classification)

- [x] 7.1 In the classification → act-stub path, read current requisites and write them into `fop_snapshot` within the same transaction
- [x] 7.2 Update `lib/classification/types.ts` (`ActStubData` / snapshot types) to include the FOP snapshot shape

## 8. Render from settings/snapshot (capability: acts)

- [x] 8.1 Update `lib/pdf/render.ts:getFopDetails()` to read from `fop_snapshot` (prefer) and fall back to live `getFopRequisites()` only when the snapshot is absent; remove all `FOP_*` env reads
- [x] 8.2 Verify `lib/` purity boundary is respected (requisites accessors used via the render entry point, not inside pure template code)

## 9. Rebuild act template (capability: acts)

- [x] 9.1 Rewrite `lib/pdf/act-template.tsx`: two-line heading (`АКТ {number}` + `здачі-приймання робіт (надання послуг)`), place/date row (`м.{city}` / `DD.MM.YYYY`)
- [x] 9.2 Add justified preamble paragraph (ОСББ name bold from `client_snapshot`, `nameGenitive` inline, contract № + signed date)
- [x] 9.3 Add service line `{description}, {qty} шт. – {total} грн.` (integer qty) and total-in-words line using `lib/money/uah-in-words.ts`
- [x] 9.4 Add `Сторони претензій одна до одної не мають.` line
- [x] 9.5 Add bordered two-column requisites table (`Від Виконавця` / `Від Замовника`), executor from `fop_snapshot` (one account, no postal address), client from `client_snapshot` (no phone/email)
- [x] 9.6 Remove signature underlines and the `ст. 297 ПКУ` note
- [x] 9.7 Rewrite `tests/unit/acts/act-template.test.ts` for the new output (heading, preamble, service line, words line, requisites table, deviations)

## 10. Mass regeneration of existing acts (capability: acts)

- [x] 10.1 Create an idempotent script/admin action that iterates all acts, backfills `fop_snapshot` from current requisites where absent, re-renders via the new template, and updates `pdf_file_url` — without re-sending to EDO
- [x] 10.2 Document the run procedure (after deploy + prod migration) in the PR / runbook

## 11. Config & docs cleanup

- [x] 11.1 Remove `FOP_NAME` / `FOP_LEGAL_ID` / `FOP_ADDRESS` / `FOP_BANK_ACCOUNT` / `FOP_BANK_NAME` from `.env.example`
- [x] 11.2 Remove the Slice 8 `FOP_*` note from `AGENTS.md`
- [x] 11.3 Update `docs/adr/D-005-act-numbering.md` for the `MM/YYYY[/N]` format

## 12. Quality gate

- [x] 12.1 Run `npm run qa` (lint → format:check → typecheck → test:run → build → openspec validate) and fix any failures
- [x] 12.2 Capture "Real behavior proof" for the PR — a rendered new-format act PDF (screenshot or attachment) compared against the sample

## Why

The act PDF currently produced by `lib/pdf/act-template.tsx` is a generic "table" form (party lines + a service table + signature underlines). The acts historically sent to clients — captured in `docs/samples/acts/act-2026-04_200.pdf` and `act-2026-04_2000.pdf` — use a completely different "narrative" form (two-line heading, place/date row, a preamble paragraph, free-text service and total-in-words lines, and a bordered two-column requisites table). New acts must be indistinguishable from the ones clients already received, so the template needs to be rebuilt to match the samples exactly, and the supporting data (FOP requisites, act numbering, service wording, amount-in-words) brought in line.

## What Changes

- **Act number format** — change from `№4` / `№4/2` to `04/2026` / `04/2026/2` (zero-padded month + year from `act_date`, optional `/N` suffix for subsequent acts in the same month). **BREAKING** (number string format changes).
- **New "Реквізити" settings section** — FOP requisites (name in nominative + genitive, ІПН, legal address, single bank account + bank name, tax note, phone, email, city) move out of `FOP_*` environment variables into the existing key-value `settings` table under a `fop_requisites` key, editable from the admin Settings area. **BREAKING** (removes `FOP_*` env vars).
- **FOP snapshot on acts** — add a `fop_snapshot` (jsonb) column to `acts`; requisites are frozen onto each act at generation time (like `client_snapshot` / `contract_snapshot`) and the PDF renders from the snapshot, not live settings.
- **Service wording** — fixed descriptions without an embedded quantity: `access` → `Надання доступу до сервісу "Моє ОСББ" (один календарний місяць)`, `sms` → `Інтернет послуги (розсилка повідомлень)`. Unit is always `шт.`; quantity is always an integer (no `.0`).
- **Amount in words** — new pure helper rendering the UAH total in Ukrainian words (feminine гривня declension), kopecks as digits, for the "Загальна вартість…" line.
- **Act template rebuilt** — narrative layout matching the samples: two-line heading, place/date row, preamble paragraph, service line, total-in-words line, "Сторони претензій одна до одної не мають.", bordered `Від Виконавця` / `Від Замовника` requisites table. Signature underlines and the `ст. 297 ПКУ` note are removed.
- **Mass regeneration** — a one-off action re-renders every existing act through the new template and backfills `fop_snapshot`. (Risk: touches acts already sent to / signed in EDO — accepted by the user.)
- **Deliberate deviations from the samples** (recorded so they are not "fixed" later): only one executor bank account (samples show two), no postal address (samples show `а/с 631`), no client phone/email in the Замовник block (samples show them).
- **Docs** — update ADR D-005 (numbering format) and the stale `acts` spec wording ("headless Chromium" → `@react-pdf/renderer`).
- **Tests** — rewrite `act-template` unit test, add numbering tests, add amount-in-words tests.

## Capabilities

### New Capabilities

- `requisites`: storage, validation, and admin management of FOP requisites (the `fop_requisites` settings key, its Zod schema, the `/settings/requisites` admin page) plus the rule that requisites are snapshotted onto acts at generation time.

### Modified Capabilities

- `acts`: act number format becomes `MM/YYYY[/N]`; PDF template content and layout match the samples (narrative form, requisites from `fop_snapshot`, amount in words); new `fop_snapshot` column; mass regeneration of existing acts; spec text corrected to `@react-pdf/renderer`.
- `classification`: act stub creation snapshots FOP requisites into `fop_snapshot`; service descriptions use the new fixed wording; act number uses the new format.

## Impact

- **Code**: `lib/pdf/act-template.tsx` (rebuilt), `lib/pdf/render.ts` (`getFopDetails` reads from settings), `lib/acts/numbering.ts` + `lib/classification/act-stub.ts` (number format, service descriptions — note duplicated numbering logic in both), new `lib/money/uah-in-words.ts`, new `lib/requisites/` (schema + accessors), `lib/db/schema/acts.ts` (+ `fop_snapshot`).
- **DB**: Drizzle migration adding `acts.fop_snapshot` (dev branch via `npm run db:migrate`; production migrated separately per `docs/operations.md`). No new table for requisites (reuses `settings`).
- **UI**: new `app/(settings)/settings/requisites/` (page + actions + action-state + form), new `SETTINGS_NAV` entry in `app/(settings)/settings/layout.tsx`; follows DESIGN.md tokens.
- **Config**: remove `FOP_NAME` / `FOP_LEGAL_ID` / `FOP_ADDRESS` / `FOP_BANK_ACCOUNT` / `FOP_BANK_NAME` from `.env.example` and the Slice 8 `FOP_*` note in `AGENTS.md`.
- **Docs**: `docs/adr/D-005-act-numbering.md` updated for the new format.
- **Constraints**: keep `lib/` pure (no Next imports); PDF stays on `@react-pdf/renderer` (ADR D-028/D-040), no headless browser; pass `npm run qa` (D-037).

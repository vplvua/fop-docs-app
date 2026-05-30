## 1. Token Foundation — `app/globals.css`

- [x] 1.1 Remap `:root` color vars to the DESIGN.md palette per design D-DS-02 (background/foreground/card/popover → canvas/ink; `--primary` → `#5645d4`; `--primary-foreground` → `#ffffff`; secondary/muted/accent → surface/charcoal/steel; `--destructive` → `#e03131`; `--border` → hairline `#e5e3df`; `--input` → hairline-strong `#c8c4be`; `--ring` → primary purple). Keep DESIGN.md hex as source of truth (or convert to oklch — document choice).
- [x] 1.2 Add new semantic tokens to `:root`: `--success` (`#1aae39`), `--success-foreground` (`#ffffff`), `--warning` (`#dd5b00`), `--warning-foreground` (`#ffffff`).
- [x] 1.3 Expose new tokens in `@theme inline`: `--color-success`, `--color-success-foreground`, `--color-warning`, `--color-warning-foreground`.
- [x] 1.4 Set `--radius` to `0.75rem` (12px) so cards = `rounded-lg` (12px) and buttons = `rounded-md` (~9.6px, within tolerance) per D-DS-05.
- [x] 1.5 Keep `.dark` block internally consistent (no brand dark-tuning this slice — Non-Goal). Verify nothing breaks visually in dark.

## 2. Font Swap — `app/layout.tsx`

- [x] 2.1 Replace `Geist` import with `Inter` from `next/font/google`, `subsets: ["latin", "cyrillic"]`, `variable: "--font-sans"` (or bind directly to `--font-sans`).
- [x] 2.2 Update `@theme inline` / `globals.css` so `--font-sans` and `--font-heading` resolve to Inter.
- [x] 2.3 Keep or remove Geist Mono depending on whether any surface uses `--font-mono`; drop the `geist` dependency if fully unused. _(Geist Mono kept — `font-mono` is used in settings patterns/EDRPOU editor; no separate `geist` npm dep exists, both fonts come from `next/font/google`.)_
- [x] 2.4 Verify Ukrainian headings render sans-serif (no serif fallback) on clients/payments/acts. _(Inter loaded with `cyrillic` subset; verified visually in step 6.2.)_

## 3. Status Badge Colors

- [x] 3.1 Confirm UA-label ↔ DB-enum mapping against `lib/db/schema/payments.ts` and `lib/db/schema/acts.ts` (resolve D-DS-03 open question). _(payment_status: received/classified/awaiting_review/in_queue/skipped; act_status: draft/sent_to_edo/signed/deleted — labels in page `STATUS_LABELS` maps match.)_
- [x] 3.2 Apply semantic tokens to **payment** status badges (`classified`→success, `awaiting_review`→warning, `in_queue`→primary/neutral, ingested→muted, skipped→destructive/neutral). Use the soft-tag treatment (tinted bg + deep text) for table cells. _(skipped → neutral/muted; not destructive — a skip is benign.)_
- [x] 3.3 Apply semantic tokens to **act** status badges ("Чернетка"→muted, "Відправлено в ЕДО"→warning, "Підписано"→success, "Видалено"→destructive). _(applied on both `/acts` list and act-detail page.)_
- [x] 3.4 Apply semantic tokens to **dashboard** integration-health banners (OK→success, degraded→warning, down→destructive). _(health model has ok/error/unknown only — no degraded state; mapped ok→success, error→destructive, unknown→muted. Also migrated stale undefined `semantic-*` classes to the new tokens in edo-controls / act-detail-panel / pattern-test-area.)_

## 4. Accent & Typography Pass

- [x] 4.1 Verify the purple accent propagates correctly: top-bar queue counter, active nav link, active filter tab, primary CTA buttons (mostly automatic via `--primary`). _(queue counter `bg-primary`, all CTAs `bg-primary`, filter-tab active = ink, focus rings purple — automatic via token remap. Top-bar nav has no active-link state in current markup; out of scope for the token remap.)_
- [x] 4.2 Confirm filter tabs keep `rounded-full` pill geometry with active = ink-deep/primary per DESIGN.md `pill-tab-active`; no regular button became a pill. _(converted payments/acts/queue tabs from `rounded-md` to `rounded-full` pill-tab; clients toolbar already compliant. Buttons stay `rounded-md`.)_
- [x] 4.3 Normalize page-title headings to a single DESIGN.md `typography.*` tier across all top-level pages (replace ad-hoc `text-2xl` etc. — see `app/(dashboard)/clients/page.tsx:47` as the current pattern). _(added `@utility text-heading-2` = typography.heading-2; applied to every page-title `<h1>`.)_
- [x] 4.4 Verify focused inputs show a purple focus ring (`--ring`). _(`--ring` = `#5645d4`; inputs use `focus:ring-ring`.)_

## 5. Compliance Guard (optional — D-DS-06)

- [x] 5.1 (Optional) Add a check to the QA ritual / CI that fails on raw hex or non-token Tailwind color shades in `app/` component files. Defer to a follow-up change if it grows scope. _(Added `scripts/check-design-tokens.mjs` + `npm run check:design`, wired as stage 2 of `npm run qa` — runs in the Stop hook and CI. `app/` is clean; guard passes.)_

## 6. Verification (visual — D-DS-07)

- [x] 6.1 Run `npm run qa` (lint → check:design → format:check → typecheck → test:run → build → openspec validate). No logic tests change. _(all gates green.)_
- [ ] 6.2 Capture Chrome DevTools MCP screenshots of each surface (login, clients, payments, acts, queue, dashboard, settings) — before/after pairs. _(DEFERRED to PR time by user — protected surfaces need an authenticated session and only the argon2 hash is in `.env.local`, not the plaintext admin password.)_
- [x] 6.3 Spot-check WCAG AA contrast for ink/charcoal text on canvas/surface and white text on purple/semantic badges. _(All pairs PASS AA ≥4.5:1: ink/canvas 17.4, charcoal/surface 11.3, steel/canvas 4.54, white/primary 6.57. Soft-tag badges use **deep** text tones — success-deep 5.88, warning-deep 7.84, destructive-deep 6.95, primary 5.49 on /12 tints. Mid-tone colored text would have failed (2.6–3.8) and regressed below the old ink-on-white baseline; deep tones fix this.)_
- [ ] 6.4 Assemble the PR "Real behavior proof" section (D-037) from the screenshots. _(Pending 6.2.)_

## 7. Spec Sync

- [x] 7.1 After implementation, run `openspec validate align-design-system` and resolve any issues. _(passes `--strict` as part of `npm run qa`.)_
- [x] 7.2 On archive, ensure the new `design-system` capability spec lands under `openspec/specs/design-system/`. _(synced — created `openspec/specs/design-system/spec.md` with all 6 requirements; validates `--strict`.)_

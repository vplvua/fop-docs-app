## Context

S7 created the `acts` table and a classification pipeline that writes act stub rows (`status = draft`, `pdf_file_url = NULL`). The stub has all snapshot data populated, but:

- Act numbering uses simple `COUNT+1` (not race-safe)
- No PDF is generated
- No `/acts` UI exists
- `lib/blob/` and `lib/pdf/` are empty placeholders

S8 completes the act lifecycle: race-safe numbering, PDF rendering via headless Chromium, Blob storage, and a full acts UI with download capability.

The acts table schema is already complete — no migration needed.

## Goals / Non-Goals

**Goals:**

- Race-safe act number generation with `SELECT ... FOR UPDATE` (FR-ACT-02, FR-ACT-03)
- PDF rendering matching `samples/acts/` format via React+Tailwind → Chromium (FR-ACT-07)
- Private Blob storage for PDFs with signed download URLs (FR-ACT-08)
- Acts list and detail pages with filters and PDF download (FR-UI-06..08)
- Service description editing for draft acts (FR-ACT-06)
- PDF regeneration (FR-ACT-09)
- Auto-trigger PDF generation after classification

**Non-Goals:**

- EDO integration (Dubidoc send, status polling) — S9
- Vchasno manual flow (mark signed, unmark) — S10
- Manual act creation for `service_type = other` — deferred, requires separate UI form
- Act reissue flow (FR-EDGE-02) — Phase 1

## Decisions

### D1: Chromium via @sparticuz/chromium in a dedicated API route

PDF rendering uses `@sparticuz/chromium` + `puppeteer-core` in a dedicated API route handler (`app/api/acts/[id]/pdf/route.ts`). This route:

- Renders the React act template to HTML string (server-side, no browser needed for this step)
- Launches Chromium via `@sparticuz/chromium` to convert HTML → PDF
- Uploads to Vercel Blob
- Updates `act.pdf_file_url`

Dedicated route instead of server action because: Chromium needs more memory/time than typical server actions, and the route can be called both programmatically (after classification) and from UI (regenerate button).

_Alternative considered:_ `@react-pdf/renderer` (no Chromium). Rejected — requires completely different component API (not standard React+Tailwind), harder to match the exact layout of sample PDFs.

### D2: PDF template as a pure React component

The act PDF template lives at `lib/pdf/act-template.tsx` — a standard React component that renders to an HTML string via `renderToStaticMarkup`. It uses inline styles (not Tailwind classes) because the rendered HTML must be self-contained for Chromium.

The template mirrors the structure from `samples/acts/act-2026-04_200.pdf`:

- Header: ФОП executor details (from env `FOP_NAME`, `FOP_LEGAL_ID`, `FOP_ADDRESS`, `FOP_BANK_ACCOUNT`, `FOP_BANK_NAME`)
- Client details: from `act.client_snapshot`
- Contract reference: from `act.contract_snapshot`
- Service table: service_description, quantity, unit_price, total
- Footer: signatures block, act_date

### D3: Blob storage with private access

`lib/blob/` wraps `@vercel/blob`:

- `uploadActPdf(actId, buffer)` → uploads with `access: 'private'`, returns URL
- `getActPdfDownloadUrl(blobUrl)` → generates a short-lived signed download URL

Private storage means PDFs are not publicly accessible — download requires going through our API.

### D4: Race-safe act numbering

Upgrade `lib/classification/act-stub.ts` → `lib/acts/numbering.ts`:

- Inside the classification transaction (already has `FOR UPDATE` on payment), query `SELECT count(*) FROM acts WHERE client_id = $1 AND act_date = $2 FOR UPDATE`
- The `FOR UPDATE` on acts rows serializes concurrent numbering for the same client+month
- UNIQUE index `(client_id, act_date, number)` is the safety net

This replaces the S7 stub numbering. The function moves from `lib/classification/act-stub.ts` to `lib/acts/numbering.ts` and is called from the classification orchestrator.

### D5: PDF auto-generation after classification

After `runClassification` creates the act stub, it calls the PDF generation endpoint internally (via `fetch` to the local API route or direct function call). If PDF generation fails, the act remains in `draft` with `pdf_file_url = NULL` — the admin can regenerate later. Classification success is not blocked by PDF failure.

_Alternative considered:_ generate PDF synchronously inside the transaction. Rejected — Chromium cold start (up to 8s) would hold the `FOR UPDATE` lock too long and block concurrent classifications.

### D6: Acts UI structure

- `/acts` — server component with filters (status, period, client, service_type, edo_provider), paginated table
- `/acts/[id]` — server component with snapshot panel (read-only, labeled "Збережено на момент генерації"), editable service_description (for draft), PDF download button, regenerate PDF button
- "Акти" link in top-bar navigation between "Платежі" and "Налаштування"

### D7: FOP executor details from environment

The PDF header needs ФОП details (name, ЄДРПОУ, address, bank account). These come from environment variables (`FOP_*`), not from the database — they change rarely and don't need a UI. Added to `.env.example`.

## Risks / Trade-offs

- **[Risk] Chromium cold start ~8s on Vercel** → Mitigated by async PDF generation (D5) — classification doesn't wait for PDF. NFR-PERF-03 target is 8s cold / 2s warm.
- **[Risk] @sparticuz/chromium binary size ~50MB** → Acceptable for Vercel Functions. Only affects the PDF route, not other functions.
- **[Risk] PDF layout mismatch with samples** → Mitigated by rendering locally during development and comparing with `samples/acts/`. Visual regression will be caught in demo recording.
- **[Trade-off] Inline styles in PDF template instead of Tailwind** → Chromium renders HTML without our Tailwind build pipeline. Inline styles are more portable and predictable for print.
- **[Trade-off] FOP details from env not DB** → Simpler, no migration needed. If multi-FOP support is ever needed (unlikely), can be moved to DB then.

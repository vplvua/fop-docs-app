## Why

S7 (classification) creates act stub rows with `status = draft` but no PDF, no proper race-safe numbering, and no UI to view/manage acts. The act is the system's primary output — the legal document sent to clients. Without PDF generation, Blob storage, act listing, and download capability, the pipeline stops at classification and produces no real-world value.

## What Changes

- **Race-safe act numbering** — upgrade S7's simple `COUNT+1` to `SELECT ... FOR UPDATE` on acts by `(client_id, act_date)` with retry on UNIQUE violation (FR-ACT-02, FR-ACT-03)
- **PDF generation** — React+Tailwind act template → headless Chromium (`@sparticuz/chromium`) in a Vercel Function API route; matches format from `samples/acts/` (FR-ACT-07)
- **Vercel Blob storage** — upload generated PDF to private Blob, store URL in `act.pdf_file_url` (FR-ACT-08)
- **PDF regeneration** — server action to re-render and re-upload PDF from current snapshot data (FR-ACT-09)
- **Service description editing** — editable in `draft` status; for `vchasno_external` editable in any status (FR-ACT-06)
- **Acts list page** — `/acts` with filters: status, period, client, service_type, edo_provider (FR-UI-06)
- **Act detail page** — `/acts/[id]` with read-only snapshot panel, PDF download button, service description edit (FR-UI-07, FR-UI-08)
- **Navigation** — "Акти" link in top-bar
- **Auto-trigger PDF** — after successful classification creates act stub, immediately generate PDF and store in Blob

## Capabilities

### New Capabilities

- `acts`: Act generation, PDF rendering, Blob storage, acts list/detail UI, service description editing, PDF download and regeneration. Covers FR-ACT-01..10, FR-UI-06..08, NFR-PERF-03, TC-INTEG-05, TC-INTEG-12.

### Modified Capabilities

- `classification`: After creating act stub, trigger PDF generation. Act numbering upgraded to FOR UPDATE with retry.

## Impact

- **New dependencies:** `@sparticuz/chromium` (headless Chromium for Vercel), `@vercel/blob` (private Blob storage)
- **New code:** `lib/pdf/` (React template + Chromium renderer), `lib/blob/` (upload/download wrappers), `lib/acts/` (numbering, PDF trigger), `app/api/acts/[id]/pdf/route.ts` (PDF generation endpoint), `app/(dashboard)/acts/` (list + detail pages)
- **Modified code:** `lib/classification/run-classification.ts` (trigger PDF after act stub), `lib/classification/act-stub.ts` (upgrade numbering to FOR UPDATE)
- **Infrastructure:** Chromium binary in Vercel Function (~50MB layer), Blob storage for PDFs
- **DB:** no new migrations — acts table already has all needed columns from S7

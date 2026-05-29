## 1. Dependencies & Infrastructure

- [x] 1.1 Install `@sparticuz/chromium`, `puppeteer-core`, `@vercel/blob` — add to package.json
- [x] 1.2 Add FOP executor env vars to `.env.example`: `FOP_NAME`, `FOP_LEGAL_ID`, `FOP_ADDRESS`, `FOP_BANK_ACCOUNT`, `FOP_BANK_NAME`

## 2. Vercel Blob Wrapper

- [x] 2.1 Implement `lib/blob/index.ts` — `uploadActPdf(actId, buffer)` (private access, returns URL) and `getActPdfDownloadUrl(blobUrl)` (signed short-lived URL)

## 3. PDF Template & Renderer

- [x] 3.1 Create `lib/pdf/act-template.tsx` — React component rendering act HTML with inline styles matching `samples/acts/` format: ФОП header (from env), client snapshot, contract snapshot, service table, signatures block, act_date
- [x] 3.2 Create `lib/pdf/render.ts` — `renderActPdf(actData)`: renders template to HTML string via `renderToStaticMarkup`, launches Chromium, converts HTML → PDF buffer
- [x] 3.3 Create `app/api/acts/[id]/pdf/route.ts` — POST handler: loads act from DB, calls `renderActPdf`, uploads to Blob via `uploadActPdf`, updates `act.pdf_file_url`

## 4. Race-Safe Act Numbering

- [x] 4.1 Create `lib/acts/numbering.ts` — `nextActNumber(tx, clientId, actDate)` with `SELECT count(*) ... FOR UPDATE` on acts for same `(client_id, act_date)`, returns formatted number `№M` or `№M/N`
- [x] 4.2 Update `lib/classification/run-classification.ts` to use `nextActNumber` from `lib/acts/` instead of the S7 stub logic

## 5. PDF Auto-Trigger After Classification

- [x] 5.1 Create `lib/acts/generate-pdf.ts` — `triggerPdfGeneration(actId)`: calls the PDF API route internally (fetch to `/api/acts/[id]/pdf`), logs success/failure, does not throw on failure
- [x] 5.2 Integrate PDF trigger into `lib/classification/run-classification.ts` — call `triggerPdfGeneration` after transaction commits (outside the transaction)

## 6. Server Actions

- [x] 6.1 Create `app/(dashboard)/acts/[id]/act-actions.ts` — `regeneratePdfAction(actId)`: validates act exists, calls PDF API route, returns result
- [x] 6.2 Create `updateServiceDescriptionAction(actId, description)` in same file — validates status (draft for dubidoc, any for vchasno_external), updates field, triggers PDF regeneration
- [x] 6.3 Create `app/(dashboard)/acts/[id]/download-action.ts` — `getDownloadUrlAction(actId)`: reads `pdf_file_url`, returns signed download URL via `getActPdfDownloadUrl`

## 7. UI — Acts List & Detail

- [x] 7.1 Create `app/(dashboard)/acts/page.tsx` — acts list with table (act_date, number, client name, service_type, status badge, edo_provider, total amount) and filters (status, period, service_type, edo_provider, text search)
- [x] 7.2 Create `app/(dashboard)/acts/[id]/page.tsx` — act detail with read-only snapshot panel ("Збережено на момент генерації"), editable service_description (conditional), status badge, PDF download button, regenerate PDF button
- [x] 7.3 Add "Акти" link to top-bar navigation between "Платежі" and "Налаштування"

## 8. Unit Tests

- [x] 8.1 Tests for `lib/acts/numbering.ts` — first act in month (№M), subsequent (№M/N), correct month extraction
- [x] 8.2 Tests for `lib/pdf/act-template.tsx` — rendered HTML contains ФОП header, client snapshot fields, contract reference, service table, act_date
- [x] 8.3 Tests for `lib/blob/index.ts` — upload calls Blob API with correct params, download generates signed URL

## 9. Validation & QA

- [x] 9.1 Run `npm run qa` — all 6 gates green
- [x] 9.2 Manual smoke: classify a payment → act created → PDF generated in Blob → download PDF → verify content matches sample format

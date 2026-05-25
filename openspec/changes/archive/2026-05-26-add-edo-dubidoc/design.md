## Context

S8 (acts) delivers act generation with PDF in Blob, but acts stay in `draft` forever. The admin must manually upload each to DubiDoc — the single biggest remaining manual step in the MVP pipeline. S9 closes the automation loop by sending acts to DubiDoc via their Premium API and polling for status updates.

The acts table already has all EDO fields (`edo_doc_id TEXT`, `edo_status TEXT`, `sent_to_edo_at TIMESTAMPTZ`, `status` enum includes `sent_to_edo`/`signed`/`deleted`) from S7/S8 migrations. The classification pipeline already routes `edo_provider = dubidoc` clients to auto-act generation. No schema changes needed.

DubiDoc Premium API (D-029): `POST /api/v1/documents` with base64 PDF, inline `participants[]`, `signatureType = "external"`, `workflowType = "sequential"`. Status polling via `GET /api/v1/documents/{id}`. No webhooks (polling-only, D-029).

**Constraints:**

- `DUBIDOC_TOKEN` in env (NFR-SEC-02), already in `.env.example`.
- TBD-S9-1: sandbox token for DubiDoc Premium needed before E2E.
- DubiDoc does not allow signing a document before its `date` (BC-LEGAL-06), but this doesn't affect our send logic — we send immediately, signing happens later in DubiDoc UI.

## Goals / Non-Goals

**Goals:**

- Auto-send acts to DubiDoc immediately after creation for `edo_provider = dubidoc` clients.
- Poll DubiDoc every N hours (configurable via `Settings.dubidoc_poll_interval_hours`) and update act statuses.
- Provide manual UI controls: retry failed sends, refresh status on-demand, link to DubiDoc document.
- Handle failure gracefully: retry with backoff, idempotency guard (`edo_doc_id IS NULL`), integration health tracking.

**Non-Goals:**

- Webhook integration with DubiDoc (BC-SCOPE-08, Phase 2).
- Batch sending (one act = one API call).
- DubiDoc contacts sync (D-029: inline participants only).
- Auto-signing by admin (BC-LEGAL-04: admin signs manually in DubiDoc UI).

## Decisions

### D1: DubiDoc HTTP client structure — mirror PrivatBank client pattern

The `lib/external-apis/dubidoc/` module follows the same structure as `lib/external-apis/privatbank/`:

- `types.ts` — request/response interfaces, custom error classes (`DubiDocAuthError`, `DubiDocApiError`).
- `client.ts` — `createDocument(payload)` and `getDocumentStatus(docId)` with recursive retry/backoff (1s/5s/30s for 5xx/timeout), 401 → `DubiDocAuthError`, 429 → respect `Retry-After`.
- `mapper.ts` — `actToCreateDocumentPayload(act, pdfBase64)` assembles the DubiDoc request body from act snapshot fields.

**Why mirror PrivatBank:** consistent error handling, retry patterns, MSW-testable. Separate mapper keeps the client generic.

### D2: Send-to-EDO orchestrator — `lib/edo/send-to-dubidoc.ts`

A single function `sendActToDubidoc(actId)` that:

1. Loads the act from DB. Validates: `status === 'draft'`, `edo_provider === 'dubidoc'`, `edo_doc_id IS NULL` (idempotency, TC-INTEG-13), `pdf_file_url IS NOT NULL`.
2. Downloads PDF from Vercel Blob (private URL → Buffer → base64).
3. Calls `mapper.actToCreateDocumentPayload(act, pdfBase64)`.
4. Calls `client.createDocument(payload)`.
5. On success: updates act `status = 'sent_to_edo'`, `edo_doc_id = response.id`, `sent_to_edo_at = now()`.
6. On failure: leaves act as `draft`, logs error, updates `integration_health(service='dubidoc')` with error.

**Hook point:** After `triggerPdfGeneration(actId)` completes in `run-classification.ts`, chain `sendActToDubidoc(actId)`. Since PDF generation is async (internal fetch to `/api/acts/{id}/pdf`), the send must happen after PDF is ready. Two options:

- **Option A (chosen):** The PDF route handler (`app/api/acts/[id]/pdf/route.ts`) chains the DubiDoc send after successful PDF upload. This ensures PDF exists before send attempt.
- **Option B (rejected):** Poll for `pdf_file_url` existence before sending. Adds complexity and latency.

For manual retry (act stuck in `draft` after failed send), a server action `retryDubidocSendAction(actId)` calls `sendActToDubidoc` directly.

### D3: Polling cron — `app/api/cron/dubidoc-poll/route.ts`

Structure mirrors `privatbank-poll/route.ts`:

1. `CRON_SECRET` auth guard.
2. Query all acts: `status = 'sent_to_edo' AND edo_provider = 'dubidoc'`.
3. For each act: `GET /api/v1/documents/{edo_doc_id}`.
4. Map response to act status per D-029 rules:
   - `status === "signed"` → `act.status = signed`
   - `archived === true` → `act.status = deleted`, `payment.act_id = NULL` (FR-EDGE-01)
   - `refused === true` → `act.edo_status = "refused"`, `act.status` stays `sent_to_edo`
   - Other values → `act.edo_status = <raw value>`, `act.status` stays `sent_to_edo`
5. Update `integration_health(service='dubidoc')`.

Registered in `vercel.ts` as `{ path: "/api/cron/dubidoc-poll", schedule: "0 */6 * * *" }`.

Sequential polling (not parallel) to avoid rate-limiting. At MVP scale (~500 acts/month, ~50 pending at peak), sequential is fine.

**Archived act handling (FR-EDGE-01):** When DubiDoc says `archived = true`, the act transitions to `deleted` and `payment.act_id` is set to `NULL`. This makes the payment available for re-classification. The `payment.act_id` FK is `ON DELETE SET NULL`, but we don't delete the act row — we set `status = deleted` explicitly and null out the payment FK manually.

### D4: UI changes — act card EDO controls

Add to `ActDetailPanel`:

- **"Перейти в Дубідок"** link: `https://my.dubidoc.com.ua/documents/{edo_doc_id}` (FR-EDO-12). Visible when `edo_doc_id` is set.
- **"Оновити статус"** button: calls `refreshDubidocStatusAction(actId)` which does a single `getDocumentStatus` + status mapping. Visible when `status = sent_to_edo` and `edo_provider = dubidoc`.
- **"Спробувати ще раз"** button: calls `retryDubidocSendAction(actId)`. Visible when `status = draft` and `edo_provider = dubidoc` and `pdf_file_url IS NOT NULL`.
- **Status indicators:**
  - `draft` + `dubidoc` + `pdf_file_url` set → "Не відправлено в Дубідок" warning with retry button (FR-EDO-09).
  - `sent_to_edo` + `edo_status = "refused"` → "Клієнт відмовився від підпису" banner.
  - `sent_to_edo` + other `edo_status` → show raw `edo_status` as secondary text.
  - `signed` → success badge.

### D5: Dashboard "Опитати статуси Дубідок" button

Server action `triggerDubidocPollAction()` runs the same polling logic as the cron (without the CRON_SECRET guard). Reuse a shared `pollDubidocStatuses()` function extracted from the cron handler.

### D6: MSW mock handler

`tests/mocks/handlers/dubidoc.ts` — mock endpoints:

- `POST https://api.dubidoc.com.ua/api/v1/documents` → returns `{ id: "mock-doc-id", status: "new" }`.
- `GET https://api.dubidoc.com.ua/api/v1/documents/:id` → returns configurable status response.

Pattern matches `tests/mocks/handlers/privatbank.ts`.

## Risks / Trade-offs

- **[TBD-S9-1: No sandbox token yet]** → Mitigation: MSW mocks cover unit/smoke tests. E2E against real DubiDoc requires obtaining sandbox token before that phase. Manual smoke can be done with real token in dev.
- **[PDF generation is async]** → Mitigation: DubiDoc send is chained from the PDF route handler (D2, Option A), so the send only fires after PDF is successfully stored in Blob.
- **[DubiDoc API instability]** → Mitigation: `edo_status` is `text` not enum (D-029), so unknown statuses are stored verbatim. Retry with backoff for transient failures.
- **[Sequential polling may be slow at scale]** → At MVP scale (~50 pending acts max), sequential polling finishes in <60s. Not a concern until ~3000 clients (NFR-SCALE-03).
- **[Archived act re-classification]** → When DubiDoc archives a document, the payment becomes re-classifiable. The re-run may produce a new act. This is the intended behavior per FR-EDGE-01.

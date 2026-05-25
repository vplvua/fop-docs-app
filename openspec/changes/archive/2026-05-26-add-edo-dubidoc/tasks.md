## 1. DubiDoc HTTP client

- [x] 1.1 Create `lib/external-apis/dubidoc/types.ts` — request/response interfaces (`CreateDocumentRequest`, `CreateDocumentResponse`, `DocumentStatusResponse`), error classes (`DubiDocAuthError`, `DubiDocApiError`)
- [x] 1.2 Create `lib/external-apis/dubidoc/client.ts` — `createDocument(payload)` and `getDocumentStatus(docId)` with retry/backoff (1s/5s/30s), 401 → AuthError, 429 → Retry-After, uses `DUBIDOC_TOKEN` from env
- [x] 1.3 Create `lib/external-apis/dubidoc/mapper.ts` — `actToCreateDocumentPayload(act, pdfBase64)` assembles DubiDoc request from act snapshot fields (file, filename, title, date, number, amount, signatureType, workflowType, participants[])
- [x] 1.4 Create `lib/external-apis/dubidoc/index.ts` — re-export public API

## 2. Send-to-EDO orchestrator

- [x] 2.1 Create `lib/edo/send-to-dubidoc.ts` — `sendActToDubidoc(actId)`: load act, validate preconditions (status=draft, edo_provider=dubidoc, edo_doc_id IS NULL, pdf_file_url set), download PDF from Blob, call mapper + client, update act (status=sent_to_edo, edo_doc_id, sent_to_edo_at), update integration_health
- [x] 2.2 Hook auto-send into PDF generation pipeline — after successful PDF upload in `app/api/acts/[id]/pdf/route.ts`, call `sendActToDubidoc(actId)` for dubidoc acts (fire-and-forget with error logging)

## 3. DubiDoc polling

- [x] 3.1 Create `lib/edo/poll-dubidoc.ts` — `pollDubidocStatuses()`: query all acts with status=sent_to_edo AND edo_provider=dubidoc, poll each via `getDocumentStatus`, apply status mapping (signed→signed, archived→deleted+null payment.act_id, refused→edo_status only, other→edo_status only), update integration_health
- [x] 3.2 Create `app/api/cron/dubidoc-poll/route.ts` — cron handler with CRON_SECRET guard, calls `pollDubidocStatuses()`, logs results
- [x] 3.3 Register cron in `vercel.ts` — add `{ path: "/api/cron/dubidoc-poll", schedule: "0 */6 * * *" }`

## 4. Server actions

- [x] 4.1 Create `retryDubidocSendAction(actId)` in act actions — calls `sendActToDubidoc`, returns `{ ok, error? }`
- [x] 4.2 Create `refreshDubidocStatusAction(actId)` in act actions — single `getDocumentStatus` + status mapping for one act, returns `{ ok, error? }`
- [x] 4.3 Create `triggerDubidocPollAction()` in dashboard actions — calls `pollDubidocStatuses()`, returns result summary

## 5. UI — act detail page

- [x] 5.1 Add "Перейти в Дубідок" link — visible when `edo_doc_id` is set, links to `https://my.dubidoc.com.ua/documents/{edo_doc_id}`
- [x] 5.2 Add "Оновити статус" button — visible for `status=sent_to_edo AND edo_provider=dubidoc`, calls `refreshDubidocStatusAction`
- [x] 5.3 Add "Спробувати ще раз" button — visible for `status=draft AND edo_provider=dubidoc AND pdf_file_url IS NOT NULL`, calls `retryDubidocSendAction`
- [x] 5.4 Add status indicators — "Не відправлено" warning for draft dubidoc acts with PDF; "Клієнт відмовився від підпису" banner for edo_status=refused; raw edo_status display for other intermediate statuses; "Підписано" success badge for signed

## 6. UI — dashboard poll button

- [x] 6.1 Add "Опитати статуси Дубідок" button to dashboard — calls `triggerDubidocPollAction`, shows loading state and result

## 7. MSW mock handler

- [x] 7.1 Create `tests/mocks/handlers/dubidoc.ts` — mock `POST /api/v1/documents` (returns `{ id, status: "new" }`) and `GET /api/v1/documents/:id` (configurable status response)

## 8. Tests

- [x] 8.1 Unit tests for `mapper.ts` — verify payload assembly: file base64, participants from snapshot, amount calculation, date/number/title mapping
- [x] 8.2 Unit tests for `client.ts` — verify retry/backoff on 5xx, AuthError on 401, Retry-After on 429 (via MSW)
- [x] 8.3 Unit tests for `send-to-dubidoc.ts` — verify precondition checks (skip if edo_doc_id set, skip if not dubidoc, skip if no PDF), success path (status transition), failure path (status stays draft)
- [x] 8.4 Unit tests for `poll-dubidoc.ts` — verify status mapping for all 4 cases (signed, archived, refused, intermediate), verify payment.act_id nulled on archived
- [x] 8.5 Unit tests for server actions — verify action wrappers return correct `{ ok, error }` shape

## 9. QA and verification

- [x] 9.1 Run `npm run qa` — all 6 gates green (lint, format:check, typecheck, test:run, build, openspec validate)
- [x] 9.2 Manual smoke test — create act for dubidoc client → verify send attempt (with MSW or real token) → verify act status transitions → verify UI controls

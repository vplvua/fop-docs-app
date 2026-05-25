## ADDED Requirements

### Requirement: Auto-send act to DubiDoc after creation

For acts with `edo_provider = dubidoc`, the system SHALL automatically send the act to DubiDoc via `POST /api/v1/documents` after the PDF has been successfully generated and stored in Blob. The request SHALL include: `file` (base64-encoded PDF), `filename`, `title`, `date` = `act_date`, `number`, `amount` (integer, total = unit_price × quantity), `signatureType = "external"`, `workflowType = "sequential"`. On successful response, the system SHALL set `Act.status = sent_to_edo`, `Act.edo_doc_id = <response.id>`, `Act.sent_to_edo_at = now()`.

Covers: FR-EDO-01, FR-EDO-04, NFR-PERF-04.

#### Scenario: Successful auto-send after classification

- **WHEN** a payment is classified for a client with `edo_provider = dubidoc` and the PDF is generated successfully
- **THEN** the system SHALL call DubiDoc `POST /documents` with the act's PDF and metadata, and the act SHALL transition from `draft` to `sent_to_edo` with `edo_doc_id` set

#### Scenario: Auto-send skipped for vchasno_external

- **WHEN** a payment is classified for a client with `edo_provider = vchasno_external`
- **THEN** the system SHALL NOT call the DubiDoc API; the act SHALL remain in `draft`

### Requirement: DubiDoc participants inline

The `participants[]` array in the DubiDoc request SHALL contain exactly one element: `{ action: "sign", email: <client_snapshot.email>, edrpou: <client_snapshot.legal_id>, priority: 1, isSignatureRequired: true }`. No separate contacts sync SHALL be performed.

Covers: FR-EDO-02, FR-EDO-03.

#### Scenario: Participant assembled from act snapshot

- **WHEN** an act is sent to DubiDoc with `client_snapshot = { email: "test@example.com", legal_id: "12345678", ... }`
- **THEN** `participants` SHALL be `[{ action: "sign", email: "test@example.com", edrpou: "12345678", priority: 1, isSignatureRequired: true }]`

#### Scenario: No contacts sync call

- **WHEN** an act is sent to DubiDoc
- **THEN** the system SHALL NOT call `/api/v1/contacts`

### Requirement: DubiDoc send retry with backoff

On `5xx` or timeout from DubiDoc `POST /documents`, the system SHALL retry up to 3 times with backoff delays of 1s, 5s, 30s. If all retries fail, `Act.status` SHALL remain `draft`. The act SHALL display a "Не відправлено" indicator in the UI with a "Спробувати ще раз" button.

Covers: FR-EDO-09.

#### Scenario: Transient 500 error — retry succeeds

- **WHEN** DubiDoc returns `500` on the first attempt but `200` on the second
- **THEN** the act SHALL transition to `sent_to_edo` after the successful retry

#### Scenario: All retries exhausted

- **WHEN** DubiDoc returns `500` on all 3 retry attempts
- **THEN** `Act.status` SHALL remain `draft`, and the UI SHALL show a "Не відправлено" indicator with a retry button

### Requirement: DubiDoc send idempotency

Before sending to DubiDoc (including retries), the system SHALL verify `Act.edo_doc_id IS NULL`. If `edo_doc_id` is already set, the send SHALL NOT execute.

Covers: FR-EDO-10, TC-INTEG-13.

#### Scenario: Retry skipped when edo_doc_id already set

- **WHEN** the admin clicks "Спробувати ще раз" on an act that already has `edo_doc_id` set
- **THEN** the system SHALL NOT call DubiDoc API and SHALL return without error

#### Scenario: Race condition — concurrent sends

- **WHEN** two concurrent send attempts fire for the same act
- **THEN** only one SHALL succeed in calling DubiDoc; the other SHALL see `edo_doc_id IS NOT NULL` and skip

### Requirement: DubiDoc status polling cron

A cron job SHALL run at the interval defined by `Settings.dubidoc_poll_interval_hours` (default 6 hours). It SHALL query all acts with `status = sent_to_edo AND edo_provider = dubidoc` and call `GET /api/v1/documents/{edo_doc_id}` for each.

Covers: FR-EDO-05.

#### Scenario: Polling cron runs on schedule

- **WHEN** the cron fires at the configured interval
- **THEN** the system SHALL fetch status for every act with `status = sent_to_edo AND edo_provider = dubidoc`

#### Scenario: No pending acts

- **WHEN** the cron fires but no acts have `status = sent_to_edo`
- **THEN** the system SHALL complete successfully without making any DubiDoc API calls

### Requirement: DubiDoc status mapping

The polling response SHALL be mapped to act status as follows: `status = "signed"` → `Act.status = signed`; `archived = true` → `Act.status = deleted` and `Payment.act_id = NULL`; `refused = true` → `Act.edo_status = "refused"` (Act.status remains `sent_to_edo`); all other values → `Act.edo_status = <raw status value>` (Act.status remains `sent_to_edo`). `Act.edo_status` is `text` type, not enum.

Covers: FR-EDO-06, FR-EDO-07.

#### Scenario: Document signed in DubiDoc

- **WHEN** polling returns `{ status: "signed" }` for an act
- **THEN** `Act.status` SHALL be updated to `signed`

#### Scenario: Document archived in DubiDoc

- **WHEN** polling returns `{ archived: true }` for an act
- **THEN** `Act.status` SHALL be updated to `deleted`, and `Payment.act_id` SHALL be set to `NULL`

#### Scenario: Document refused in DubiDoc

- **WHEN** polling returns `{ refused: true }` for an act
- **THEN** `Act.edo_status` SHALL be `"refused"`, `Act.status` SHALL remain `sent_to_edo`

#### Scenario: Intermediate DubiDoc status

- **WHEN** polling returns `{ status: "sent_for_sign" }` for an act
- **THEN** `Act.edo_status` SHALL be `"sent_for_sign"`, `Act.status` SHALL remain `sent_to_edo`

### Requirement: Archived act releases payment for re-classification

When DubiDoc reports a document as archived (`archived = true`), the payment previously linked to the deleted act SHALL become available for re-classification. `Payment.act_id` SHALL be set to `NULL`, and `Payment.status` SHALL be eligible for reclassification.

Covers: FR-EDGE-01.

#### Scenario: Payment re-classifiable after act deletion

- **WHEN** polling detects `archived = true` and sets `Act.status = deleted`
- **THEN** `Payment.act_id` SHALL be `NULL`, and the payment SHALL appear in the queue as available for classification

### Requirement: No webhook registration

The system SHALL NOT pass `callbackUrl` in the DubiDoc `POST /documents` request. Status updates SHALL be obtained exclusively via polling.

Covers: FR-EDO-08, BC-SCOPE-08.

#### Scenario: No callbackUrl in request

- **WHEN** a document is created via DubiDoc API
- **THEN** the request body SHALL NOT contain a `callbackUrl` field

### Requirement: Manual status refresh from act card

The admin SHALL be able to trigger a single `GET /api/v1/documents/{edo_doc_id}` from the act detail page via an "Оновити статус" button. The result SHALL be mapped using the same rules as the polling cron.

Covers: FR-EDO-11.

#### Scenario: Manual refresh updates status

- **WHEN** the admin clicks "Оновити статус" on an act with `status = sent_to_edo`
- **THEN** the system SHALL call `GET /documents/{edo_doc_id}` and update `Act.status` / `Act.edo_status` accordingly

#### Scenario: Button hidden for non-dubidoc acts

- **WHEN** the act has `edo_provider = vchasno_external`
- **THEN** the "Оновити статус" button SHALL NOT be displayed

### Requirement: DubiDoc document link in UI

For acts with `edo_doc_id` set, the act detail page SHALL display a link to `https://my.dubidoc.com.ua/documents/{edo_doc_id}` labeled "Перейти в Дубідок".

Covers: FR-EDO-12.

#### Scenario: Link displayed for sent act

- **WHEN** the act has `edo_doc_id = "abc123"`
- **THEN** the UI SHALL show a link to `https://my.dubidoc.com.ua/documents/abc123`

#### Scenario: No link for draft act without edo_doc_id

- **WHEN** the act has `edo_doc_id = NULL`
- **THEN** no DubiDoc link SHALL be displayed

### Requirement: Manual retry for failed DubiDoc send

For acts with `status = draft`, `edo_provider = dubidoc`, and `pdf_file_url IS NOT NULL`, the act detail page SHALL display a "Спробувати ще раз" button that triggers `sendActToDubidoc`.

Covers: FR-EDO-09.

#### Scenario: Retry button triggers send

- **WHEN** the admin clicks "Спробувати ще раз" on a draft dubidoc act with PDF
- **THEN** the system SHALL attempt to send the act to DubiDoc

#### Scenario: Retry button hidden when no PDF

- **WHEN** the act has `status = draft` and `pdf_file_url = NULL`
- **THEN** the "Спробувати ще раз" button SHALL NOT be displayed

### Requirement: DubiDoc refused indicator

When `Act.edo_status = "refused"`, the act detail page SHALL display a "Клієнт відмовився від підпису" banner.

#### Scenario: Refused banner shown

- **WHEN** the act has `edo_status = "refused"`
- **THEN** the UI SHALL display a warning banner with text "Клієнт відмовився від підпису"

#### Scenario: Banner not shown for other statuses

- **WHEN** the act has `edo_status = "sent_for_sign"`
- **THEN** the refused banner SHALL NOT be displayed

### Requirement: Dashboard DubiDoc poll trigger

The dashboard SHALL include a "Опитати статуси Дубідок" button that triggers the same polling logic as the cron, outside of the cron schedule.

Covers: FR-UI-03.

#### Scenario: Manual poll from dashboard

- **WHEN** the admin clicks "Опитати статуси Дубідок" on the dashboard
- **THEN** the system SHALL poll DubiDoc for all acts with `status = sent_to_edo AND edo_provider = dubidoc` and update statuses

### Requirement: Integration health tracking for DubiDoc

Both the send and polling operations SHALL update `integration_health` for `service = 'dubidoc'`. On success: `last_success_at = now()`. On failure: `last_error_at = now()`, `last_error_code`, `last_error_message`.

#### Scenario: Successful send updates health

- **WHEN** `POST /documents` succeeds
- **THEN** `integration_health` for `dubidoc` SHALL have `last_success_at` updated

#### Scenario: Failed polling updates health

- **WHEN** the polling cron encounters a DubiDoc API error
- **THEN** `integration_health` for `dubidoc` SHALL have `last_error_at`, `last_error_code`, and `last_error_message` updated

### Requirement: DubiDoc cron registered in vercel.ts

The DubiDoc polling cron SHALL be registered in `vercel.ts` at path `/api/cron/dubidoc-poll` with schedule `0 */6 * * *` (every 6 hours).

#### Scenario: Cron registered

- **WHEN** `vercel.ts` is loaded
- **THEN** the crons array SHALL include `{ path: "/api/cron/dubidoc-poll", schedule: "0 */6 * * *" }`

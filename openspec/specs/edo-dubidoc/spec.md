# edo-dubidoc Specification

## Purpose

DubiDoc EDO integration — automatic act sending via POST /api/v1/documents, polling-based status sync (signed/archived/refused), retry with idempotency guard, UI controls for manual send/retry/status-refresh. Covers FR-EDO-01..12, FR-EDGE-01, TC-INTEG-02, TC-INTEG-13, NFR-PERF-04..06.

## Requirements

### Requirement: Auto-send act to DubiDoc after creation

For acts with `edo_provider = dubidoc`, the system SHALL automatically send the act to DubiDoc via `POST /api/v1/documents` after the PDF has been successfully generated and stored in Blob. The request SHALL include: `file` (base64-encoded PDF), `filename`, `title`, `date` = `act_date`, `number`, `amount`, `signatureType = "external"`, `workflowType = "sequential"`. The `amount` field SHALL be the act's stored total `amount` expressed in **kopiykas** (integer minor units) — i.e. `round(act.amount × 100)` — because DubiDoc interprets the value in kopiykas (sending hryvnias makes the displayed sum 100× too small). The `amount` SHALL be derived from `act.amount` (the actual paid total), NOT from `unit_price × quantity`, so discounted annual acts carry the correct sum. On successful response, the system SHALL set `Act.status = sent_to_edo`, `Act.edo_doc_id = <response.id>`, `Act.sent_to_edo_at = now()`.

Covers: FR-EDO-01, FR-EDO-04, NFR-PERF-04.

#### Scenario: Successful auto-send after classification

- **WHEN** a payment is classified for a client with `edo_provider = dubidoc` and the PDF is generated successfully
- **THEN** the system SHALL call DubiDoc `POST /documents` with the act's PDF and metadata, and the act SHALL transition from `draft` to `sent_to_edo` with `edo_doc_id` set

#### Scenario: Amount sent in kopiykas from the stored total

- **WHEN** an act with `amount = 200.00` is sent to DubiDoc
- **THEN** the payload `amount` SHALL be `20000` (kopiykas), so DubiDoc displays `200.00`

#### Scenario: Annual act amount is the paid total, not the product

- **WHEN** an annual act with `unit_price = 200.00`, `quantity = 12`, `amount = 2000.00` is sent to DubiDoc
- **THEN** the payload `amount` SHALL be `200000` (kopiykas of 2000.00), NOT `240000` and NOT `2400`

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

A cron job SHALL run at the interval defined by `Settings.dubidoc_poll_interval_hours` (default 6 hours). It SHALL query all acts that are still pending in DubiDoc — `status ∈ {sent_to_edo, waiting_for_client_sign} AND edo_provider = dubidoc` — and call `GET /api/v1/documents/{edo_doc_id}` for each. Acts in `waiting_for_client_sign` MUST remain in the polled set so they can advance to `signed`.

Covers: FR-EDO-05.

#### Scenario: Polling cron runs on schedule

- **WHEN** the cron fires at the configured interval
- **THEN** the system SHALL fetch status for every act with `status ∈ {sent_to_edo, waiting_for_client_sign} AND edo_provider = dubidoc`

#### Scenario: Awaiting-client act keeps being polled

- **WHEN** an act has `status = waiting_for_client_sign` and the client then signs in DubiDoc
- **THEN** the next poll SHALL include that act and update its `status` to `signed`

#### Scenario: No pending acts

- **WHEN** the cron fires but no acts have `status ∈ {sent_to_edo, waiting_for_client_sign}`
- **THEN** the system SHALL complete successfully without making any DubiDoc API calls

### Requirement: DubiDoc status mapping

The polling/status response SHALL be mapped to act status using the **document-level `state`** (`new → sent → signed`) as the authoritative signal, because the top-level `status` field is computed **relative to the authenticated organization** (the FOP) — once the FOP signs, `status` reads `signed` even though the client has not, which would otherwise mark a half-signed act as fully `signed`.

Mapping (when `state` is present):

- `state = "signed"` → `Act.status = signed` (all parties signed).
- `archived = true` → `Act.status = deleted` and `Payment.act_id = NULL`.
- `refused = true` → `Act.edo_status = "refused"` (Act.status unchanged).
- `state = "sent"` → `Act.status = waiting_for_client_sign` (forwarded to the client, awaiting their signature).
- `state = "new"` and org `status ∈ { "signed", "waiting_for_contractor_sign" }` → `Act.status = waiting_for_client_sign` (the FOP has signed; the flow has not advanced yet).
- `state = "new"` and org `status = "new"` → `Act.status = sent_to_edo` (awaiting the FOP's signature).
- all other values → `Act.edo_status = <raw status value>` (Act.status unchanged).

When `state` is ABSENT (older responses), the legacy org-relative `status` mapping SHALL apply: `signed → signed`; `archived → deleted`; `refused → edo_status`; `new → sent_to_edo`; `waiting_for_contractor_sign → waiting_for_client_sign`; otherwise raw `edo_status`.

`Act.edo_status` is `text` type, not enum. The same mapping SHALL be applied by both the polling cron and the manual refresh, via a single shared mapper.

Covers: FR-EDO-06, FR-EDO-07.

#### Scenario: Both parties signed (document-level state)

- **WHEN** the status response is `{ state: "signed" }` for an act
- **THEN** `Act.status` SHALL be updated to `signed`

#### Scenario: FOP signed but flow not advanced is NOT fully signed

- **WHEN** the status response is `{ state: "new", status: "signed" }` (org-relative `signed`)
- **THEN** `Act.status` SHALL be `waiting_for_client_sign`, NOT `signed`

#### Scenario: Forwarded to the client

- **WHEN** the status response is `{ state: "sent" }` for an act
- **THEN** `Act.status` SHALL be `waiting_for_client_sign` and `Act.edo_status` SHALL be `"sent"`

#### Scenario: Just sent, awaiting the FOP

- **WHEN** the status response is `{ state: "new", status: "new" }` for an act
- **THEN** `Act.status` SHALL remain `sent_to_edo` and `Act.edo_status` SHALL be `"new"`

#### Scenario: Document archived in DubiDoc

- **WHEN** the status response includes `{ archived: true }` for an unfinished act
- **THEN** `Act.status` SHALL be updated to `deleted`, and `Payment.act_id` SHALL be set to `NULL`

#### Scenario: Document refused in DubiDoc

- **WHEN** the status response includes `{ refused: true }` for an act
- **THEN** `Act.edo_status` SHALL be `"refused"`, `Act.status` SHALL remain unchanged

#### Scenario: Legacy response without document-level state

- **WHEN** a status response has no `state` field and `{ status: "signed" }`
- **THEN** the legacy mapping SHALL apply and `Act.status` SHALL be `signed`

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

The admin SHALL be able to trigger a single `GET /api/v1/documents/{edo_doc_id}` from the act detail page via an "Оновити статус" button, available while the act is still pending in DubiDoc (`status ∈ {sent_to_edo, waiting_for_client_sign}`). The result SHALL be mapped using the same shared mapper as the polling cron.

Covers: FR-EDO-11.

#### Scenario: Manual refresh updates status

- **WHEN** the admin clicks "Оновити статус" on an act with `status = sent_to_edo`
- **THEN** the system SHALL call `GET /documents/{edo_doc_id}` and update `Act.status` / `Act.edo_status` accordingly

#### Scenario: Manual refresh on an awaiting-client act

- **WHEN** the admin clicks "Оновити статус" on an act with `status = waiting_for_client_sign` and the client has since signed
- **THEN** `Act.status` SHALL be updated to `signed`

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
- **THEN** the system SHALL poll DubiDoc for all acts with `status ∈ {sent_to_edo, waiting_for_client_sign} AND edo_provider = dubidoc` and update statuses

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

### Requirement: In-app FOP signing via embedded DubiDoc link

For acts with `edo_provider = dubidoc` and `status = sent_to_edo` (the FOP's own signature is still pending, raw DubiDoc `edo_status = new`), the system SHALL let the FOP place their signature without leaving the app. The act detail page SHALL show a **«Підписати тут»** button alongside the existing «Перейти в Дубідок» link. Activating it SHALL open a modal containing an `<iframe>` whose source is the DubiDoc public signing URL obtained from `POST /api/v1/documents/{edo_doc_id}/links` with body `{ action: "sign" }` (response `{ link }`). The DubiDoc signing UI inside the iframe SHALL handle the cryptographic signature (ІІТ/Дія/Mono/SmartID); the app SHALL NOT implement its own signing cryptography and SHALL NOT call `POST /documents/{id}/sign`.

The signing link SHALL be generated server-side (in a server action), never exposing the DubiDoc access token to the client; the client component SHALL receive only the resolved URL.

The «Підписати тут» button SHALL NOT be shown for `edo_provider = vchasno_external`, nor for acts in `draft`, `waiting_for_client_sign`, `signed`, or `deleted` status.

Covers: in-app signing (підхід A — iframe + public sign-link).

#### Scenario: Sign button visible for a sent, unsigned DubiDoc act

- **WHEN** an act has `edo_provider = dubidoc` and `status = sent_to_edo`
- **THEN** the act detail page SHALL display a «Підписати тут» button next to «Перейти в Дубідок»

#### Scenario: Opening the modal generates a sign link

- **WHEN** the user clicks «Підписати тут»
- **THEN** the system SHALL call DubiDoc `POST /documents/{edo_doc_id}/links` with `{ action: "sign" }` and render the returned `link` inside an `<iframe>` in a modal

#### Scenario: Access token stays server-side

- **WHEN** the signing link is generated
- **THEN** the request to DubiDoc SHALL be made server-side and the client SHALL receive only the resolved URL, never `DUBIDOC_TOKEN` or `DUBIDOC_ORGANIZATION_ID`

#### Scenario: Button hidden for non-eligible acts

- **WHEN** an act is in `draft`, `waiting_for_client_sign`, `signed`, or `deleted`, or has `edo_provider = vchasno_external`
- **THEN** the «Підписати тут» button SHALL NOT be shown

#### Scenario: No own-cryptography signing call

- **WHEN** the FOP signs through the embedded iframe
- **THEN** the system SHALL NOT call `POST /api/v1/documents/{id}/sign` from the app

### Requirement: Revoke public sign link and refresh status after signing

When the signing modal is closed (after the FOP has signed or dismissed it), the system SHALL run a finalize step that: (1) forwards the document to the client when needed, (2) revokes the public signing link via `DELETE /api/v1/documents/{edo_doc_id}/links`, and (3) refreshes the act status, then re-renders the act detail page.

Signing via the public link applies ONLY the FOP's (owner) signature — unlike the website's "Підписати та надіслати", it does NOT advance the sequential route. Therefore, when the document status shows the FOP has signed but the flow has not advanced (document `state = new` and org-relative `status = signed`), the finalize step SHALL call `POST /api/v1/documents/{edo_doc_id}/send` to forward the document to the client (`isSignatureRequired` participant), so the client receives the signing request. Forwarding and link revocation SHALL be best-effort (logged, never blocking); the status refresh result is authoritative.

If the FOP signed, the act SHALL transition `sent_to_edo → waiting_for_client_sign`; if the FOP closed the modal without signing, the act SHALL remain `sent_to_edo` and a subsequent «Підписати тут» click SHALL generate a fresh signing link.

Covers: forward-to-client + link revocation + status sync after in-app signing.

#### Scenario: Sign forwards to client, revokes link, advances status

- **WHEN** the FOP completes signing in the iframe and closes the modal, and the document is `state = new` with org `status = signed`
- **THEN** the system SHALL call `POST /documents/{edo_doc_id}/send`, then `DELETE /documents/{edo_doc_id}/links`, then refresh status, and the act SHALL transition from `sent_to_edo` to `waiting_for_client_sign`

#### Scenario: No forward when the FOP has not signed

- **WHEN** the modal is closed while the document is `state = new` with org `status = new` (FOP has not signed)
- **THEN** the system SHALL NOT call `/send`, and the act SHALL remain `sent_to_edo`

#### Scenario: No forward when the document is already fully signed

- **WHEN** the modal is closed while the document is `state = signed`
- **THEN** the system SHALL NOT call `/send`, and the act SHALL be `signed`

#### Scenario: Forwarding failure does not block finalize

- **WHEN** `/send` fails during finalize
- **THEN** the failure SHALL be logged, the link SHALL still be revoked, and the status refresh SHALL still run

### Requirement: Upload-to-DubiDoc flow is unchanged

The existing act upload flow (`POST /api/v1/documents` via `send-to-dubidoc.ts`) SHALL remain unchanged by this capability. Both outcomes SHALL be supported: (a) an act is uploaded to DubiDoc and left for the FOP to sign later, and (b) an act is uploaded and then signed in-app immediately via the modal. The in-app signing SHALL be purely additive and SHALL NOT alter how or when acts are sent to DubiDoc.

Covers: non-regression of the upload path.

#### Scenario: Upload without immediate signing

- **WHEN** an act is sent to DubiDoc and the FOP does not open the signing modal
- **THEN** the act SHALL remain in `sent_to_edo` exactly as before this change, with no behavioral difference in the send path

#### Scenario: Upload then sign in-app

- **WHEN** an act has been sent to DubiDoc (`sent_to_edo`) and the FOP signs via the modal
- **THEN** the act SHALL advance to `waiting_for_client_sign` without any change to the original send logic

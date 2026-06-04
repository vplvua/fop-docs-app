## ADDED Requirements

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

## MODIFIED Requirements

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

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

When the signing modal is closed (after the FOP has signed or dismissed it), the system SHALL revoke the public signing link via `DELETE /api/v1/documents/{edo_doc_id}/links`, then refresh the act status using the existing DubiDoc status-refresh path (`refreshDubidocStatusAction`, which maps `new → waiting_for_client_sign → signed`), and re-render the act detail page. No new status-mapping logic SHALL be introduced. If the FOP signed, the act SHALL transition `sent_to_edo → waiting_for_client_sign`; if the FOP closed the modal without signing, the act SHALL remain `sent_to_edo` and a subsequent «Підписати тут» click SHALL generate a fresh signing link.

Covers: link revocation + status sync after in-app signing.

#### Scenario: Successful sign advances status and revokes link

- **WHEN** the FOP completes signing in the iframe and closes the modal
- **THEN** the system SHALL call `DELETE /documents/{edo_doc_id}/links`, run the existing status refresh, and the act SHALL transition from `sent_to_edo` to `waiting_for_client_sign`

#### Scenario: Closing without signing leaves act recoverable

- **WHEN** the FOP closes the modal without signing
- **THEN** the link SHALL be revoked, the act SHALL remain `sent_to_edo`, and clicking «Підписати тут» again SHALL generate a new signing link

#### Scenario: Status mapping is reused, not duplicated

- **WHEN** the status is refreshed after signing
- **THEN** the system SHALL use the existing `refreshDubidocStatusAction` / `mapDubidocStatus` path and SHALL NOT add a separate status-mapping implementation

### Requirement: Upload-to-DubiDoc flow is unchanged

The existing act upload flow (`POST /api/v1/documents` via `send-to-dubidoc.ts`) SHALL remain unchanged by this capability. Both outcomes SHALL be supported: (a) an act is uploaded to DubiDoc and left for the FOP to sign later, and (b) an act is uploaded and then signed in-app immediately via the modal. The in-app signing SHALL be purely additive and SHALL NOT alter how or when acts are sent to DubiDoc.

Covers: non-regression of the upload path.

#### Scenario: Upload without immediate signing

- **WHEN** an act is sent to DubiDoc and the FOP does not open the signing modal
- **THEN** the act SHALL remain in `sent_to_edo` exactly as before this change, with no behavioral difference in the send path

#### Scenario: Upload then sign in-app

- **WHEN** an act has been sent to DubiDoc (`sent_to_edo`) and the FOP signs via the modal
- **THEN** the act SHALL advance to `waiting_for_client_sign` without any change to the original send logic

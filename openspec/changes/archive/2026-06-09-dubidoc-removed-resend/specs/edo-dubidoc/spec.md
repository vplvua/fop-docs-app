## MODIFIED Requirements

### Requirement: DubiDoc status mapping

The polling/status response SHALL be mapped to act status from **per-node signing statuses**, NOT the document-level `state`. DubiDoc leaves `state = "sent"` even after the FOP (owner) and the client have both signed — verified 2026-06-05/06 on docs `10cdf21d-…` and `bb0cb857-…` — so `state = "signed"` is treated only as a fast-path, never the sole gate.

Inputs: the document detail (`GET /api/v1/documents/{id}`) and, when needed, the participants list (`GET /api/v1/documents/{id}/participants`). The **FOP** (owner) signing state is read from the detail's `currentUser.status` (the authenticated org is the document owner/FOP). The **client** signing state is read from the participants list (`status`, `isSignatureRequired`).

Mapping (evaluated in order):

- `status = "cancelled"` (the document was cancelled/анульовано in DubiDoc) → `Act.status = deleted`, `Act.edo_status = "cancelled"`. The payment SHALL remain attached (`Payment.act_id` unchanged).
- `refused = true` OR any participant `status = "rejected"` → `Act.edo_status = "refused"` (`Act.status` unchanged).
- `state = "signed"` (fast-path) → `Act.status = signed`. No participants fetch.
- `currentUser.status ≠ "signed"` (FOP has not signed) → `Act.status = sent_to_edo`, `Act.edo_status = "new"`. No participants fetch.
- `currentUser.status = "signed"` (FOP signed): fetch participants — if at least one `isSignatureRequired` participant exists AND all such participants have `status = "signed"` → `Act.status = signed`; otherwise → `Act.status = waiting_for_client_sign`.

`archived = true` SHALL NOT be treated as a removal: an archived document is a normal (typically signed) document filed into an archive folder, so it SHALL derive its status through the same signature-based branches above (resolving to `signed` once both parties have signed). The payment SHALL NOT be freed for an archived document.

The participants fetch SHALL occur ONLY when the FOP has already signed (the last branch), to bound API volume, and SHALL run under the existing poll concurrency throttle (`POLL_CONCURRENCY = 4`). When `currentUser` is absent (older responses / mocks), the mapper SHALL fall back to the document-level `state` (`signed → signed`; `sent → waiting_for_client_sign`; `new → sent_to_edo`), with `cancelled`/`refused` still taking precedence.

`Act.edo_status` is `text` type, not enum. The same mapping SHALL be applied by both the polling cron and the manual refresh, via a single shared mapper that takes the detail plus a participants-fetcher.

Covers: FR-EDO-06, FR-EDO-07.

#### Scenario: FOP + client signed but DubiDoc state stuck at "sent"

- **WHEN** the detail is `{ state: "sent", currentUser: { role: "ROLE_OWNER", status: "signed" } }` and `GET /participants` returns every `isSignatureRequired` participant with `status = "signed"`
- **THEN** `Act.status` SHALL be updated to `signed`

#### Scenario: Fully signed via fast-path state

- **WHEN** the detail is `{ state: "signed" }`
- **THEN** `Act.status` SHALL be `signed` and the system SHALL NOT call `GET /participants`

#### Scenario: FOP signed, client signature still pending

- **WHEN** the detail is `{ state: "sent", currentUser: { status: "signed" } }` and a required participant has `status = "pending"`
- **THEN** `Act.status` SHALL be `waiting_for_client_sign`

#### Scenario: FOP has not signed yet

- **WHEN** the detail is `{ state: "new", currentUser: { status: "new" } }`
- **THEN** `Act.status` SHALL remain `sent_to_edo`, `Act.edo_status` SHALL be `"new"`, and the system SHALL NOT call `GET /participants`

#### Scenario: Document cancelled in DubiDoc

- **WHEN** the detail includes `{ status: "cancelled" }` (e.g. a signed document voided via a cancellation act, with `state = "sent"`, `archived = false`)
- **THEN** `Act.status` SHALL be updated to `deleted`, `Act.edo_status` SHALL be `"cancelled"`, and `Payment.act_id` SHALL remain unchanged

#### Scenario: Archived document is not a removal

- **WHEN** the detail includes `{ archived: true }` and the signature branches resolve to signed (FOP and all required participants signed)
- **THEN** `Act.status` SHALL be `signed`, the act SHALL NOT be marked `deleted`, and `Payment.act_id` SHALL remain unchanged

#### Scenario: Document refused in DubiDoc

- **WHEN** the detail includes `{ refused: true }`, or a participant has `status = "rejected"`
- **THEN** `Act.edo_status` SHALL be `"refused"` and `Act.status` SHALL remain unchanged

#### Scenario: Shared mapper for cron and manual refresh

- **WHEN** either the polling cron or the manual refresh evaluates a document
- **THEN** both SHALL produce identical act-status outcomes from the same shared mapper

### Requirement: Manual retry for failed DubiDoc send

For dubidoc acts that are not yet live in DubiDoc — `edo_provider = dubidoc`, `pdf_file_url IS NOT NULL`, and `status ∈ {draft, deleted}` — the act detail page SHALL display a "Надіслати в Дубідок" button that triggers `sendActToDubidoc`. For a `deleted` act this re-send SHALL first clear any stale `edo_doc_id`/`edo_status` before creating a new document (see "Re-send a removed act to DubiDoc").

Covers: FR-EDO-09.

#### Scenario: Retry button triggers send for a draft act

- **WHEN** the admin clicks "Надіслати в Дубідок" on a draft dubidoc act with PDF
- **THEN** the system SHALL attempt to send the act to DubiDoc

#### Scenario: Send button available for a removed act

- **WHEN** an act has `status = deleted` and `edo_provider = dubidoc`
- **THEN** the act detail page SHALL display the "Надіслати в Дубідок" button

#### Scenario: Retry button hidden when no PDF

- **WHEN** the act has `status = draft` and `pdf_file_url = NULL`
- **THEN** the "Надіслати в Дубідок" button SHALL NOT be displayed

### Requirement: Manual status refresh from act card

The admin SHALL be able to trigger a single `GET /api/v1/documents/{edo_doc_id}` from the act detail page via an "Оновити статус" button, available while the act is still pending in DubiDoc (`status ∈ {sent_to_edo, waiting_for_client_sign}`). The result SHALL be mapped using the same shared mapper as the polling cron. When the request returns HTTP 404 (the document was deleted in DubiDoc before signing), the act SHALL be marked removed per "Removed-document detection".

Covers: FR-EDO-11.

#### Scenario: Manual refresh updates status

- **WHEN** the admin clicks "Оновити статус" on an act with `status = sent_to_edo`
- **THEN** the system SHALL call `GET /documents/{edo_doc_id}` and update `Act.status` / `Act.edo_status` accordingly

#### Scenario: Manual refresh on an awaiting-client act

- **WHEN** the admin clicks "Оновити статус" on an act with `status = waiting_for_client_sign` and the client has since signed
- **THEN** `Act.status` SHALL be updated to `signed`

#### Scenario: Manual refresh on a deleted document

- **WHEN** the admin clicks "Оновити статус" and `GET /documents/{edo_doc_id}` returns HTTP 404
- **THEN** `Act.status` SHALL be set to `deleted`, `edo_doc_id`/`edo_status`/`sent_to_edo_at` SHALL be cleared, and `Payment.act_id` SHALL remain unchanged

## ADDED Requirements

### Requirement: Removed-document detection

A DubiDoc document that no longer represents a live act — because it was **deleted** before signing (status polling returns HTTP 404) or **cancelled/анульовано** after signing (`status = "cancelled"`) — SHALL cause the corresponding act to be marked `Act.status = deleted` ("Видалено"). On detection the system SHALL clear `edo_doc_id`, `edo_status` (set to `"cancelled"` for the cancelled case before/at clearing of the live link), and `sent_to_edo_at` as appropriate, and SHALL **retain** the act and its payment link (`Payment.act_id` unchanged, `Payment.status` unchanged). A removed act SHALL NOT be polled (it is excluded from `EDO_PENDING_STATUSES`) until it is re-sent. The reason a document is gone (deleted vs cancelled) SHALL NOT be distinguished by a separate status — a single `deleted` status covers both.

Covers: FR-EDO-06, FR-EDO-07.

#### Scenario: Deleted (unsigned) document detected via 404 during polling

- **WHEN** the polling cron calls `GET /documents/{edo_doc_id}` for a pending act and receives HTTP 404
- **THEN** `Act.status` SHALL be set to `deleted`, `edo_doc_id`/`edo_status`/`sent_to_edo_at` SHALL be cleared, and `Payment.act_id` SHALL remain unchanged

#### Scenario: Cancelled document detected during polling

- **WHEN** the polling cron evaluates a document with `status = "cancelled"`
- **THEN** `Act.status` SHALL be set to `deleted` and `Payment.act_id` SHALL remain unchanged

#### Scenario: Removed act is not polled

- **WHEN** the polling cron selects pending acts
- **THEN** acts with `status = deleted` SHALL NOT be included in the poll

### Requirement: Re-send a removed act to DubiDoc

A removed act (`status = deleted`, `edo_provider = dubidoc`) SHALL be re-sendable to DubiDoc as a brand-new document. Re-send SHALL forget any prior hash (clear `edo_doc_id` and `edo_status`), regenerate the PDF from the act's current snapshots, create a new document via `POST /documents`, and set `Act.status = sent_to_edo` with the new `edo_doc_id`. Re-send SHALL NOT auto-sign the document — it lands awaiting the FOP's signature. The act's payment link SHALL be unchanged throughout. After re-send the new hash SHALL resume normal status polling.

A removed act SHALL also receive **draft-like editing affordances** on the act detail page so a corrected document can be produced before re-sending: editing the service description, editing the manual act (when eligible), and regenerating the PDF.

Regenerating the PDF for an editable act (`status ∈ {draft, deleted}`) SHALL first refresh the act's client and contract snapshots from the live client/contract before rendering. This flows current client data — including the curated **short name** used for the DubiDoc document title — into the regenerated PDF and the subsequent send. A client has exactly one contract, so the contract resolves unambiguously. Acts in any other status (`sent_to_edo`, `waiting_for_client_sign`, `signed`) SHALL NOT have their snapshots refreshed — their content must remain as sent/signed.

Covers: FR-EDO-09, FR-EDO-11.

#### Scenario: Re-send creates a new document and resumes polling

- **WHEN** the admin clicks "Надіслати в Дубідок" on an act with `status = deleted`
- **THEN** the system SHALL clear the prior `edo_doc_id`/`edo_status`, create a new DubiDoc document, set `Act.status = sent_to_edo` with the new `edo_doc_id`, and the act SHALL again be eligible for status polling

#### Scenario: Re-send does not auto-sign

- **WHEN** a removed act is re-sent to DubiDoc
- **THEN** the new document SHALL await the FOP's signature (`Act.status = sent_to_edo`) and SHALL NOT be signed automatically

#### Scenario: Removed act exposes edit and regenerate affordances

- **WHEN** an act has `status = deleted` and `edo_provider = dubidoc`
- **THEN** the act detail page SHALL allow editing the service description, regenerating the PDF, and (when eligible) editing the manual act, in addition to the re-send button

#### Scenario: Regenerate refreshes snapshots so the short name reaches the title

- **WHEN** the admin regenerates the PDF of an editable act (`status ∈ {draft, deleted}`) whose client has since been given a curated short name absent from the act's snapshot
- **THEN** the act's client/contract snapshots SHALL be rebuilt from the live client/contract, and the next DubiDoc document's title SHALL use the short name

#### Scenario: Regenerate does not refresh snapshots of a sent/signed act

- **WHEN** the admin regenerates the PDF of an act in `sent_to_edo`, `waiting_for_client_sign`, or `signed`
- **THEN** the act's snapshots SHALL remain unchanged

## REMOVED Requirements

### Requirement: Archived act releases payment for re-classification

**Reason**: `archived = true` does not mean a document was removed — it is a normal, signed document filed into an archive folder. Freeing its payment incorrectly detaches a valid signed act and spawns a duplicate via re-classification. Archived documents now derive their status normally (→ `signed`) and keep their payment. Removal is detected only via HTTP 404 (deleted) or `status = "cancelled"`, and removal no longer frees the payment.

**Migration**: No data migration required — no acts are currently in `deleted` status, so no payments need re-linking. Going forward, archived documents remain linked to their acts and resolve to `signed`.

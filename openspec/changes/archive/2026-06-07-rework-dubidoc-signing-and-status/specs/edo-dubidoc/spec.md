## MODIFIED Requirements

### Requirement: DubiDoc status mapping

The polling/status response SHALL be mapped to act status from **per-node signing statuses**, NOT the document-level `state`. DubiDoc leaves `state = "sent"` even after the FOP (owner) and the client have both signed — verified 2026-06-05/06 on docs `10cdf21d-…` and `bb0cb857-…` — so `state = "signed"` is treated only as a fast-path, never the sole gate.

Inputs: the document detail (`GET /api/v1/documents/{id}`) and, when needed, the participants list (`GET /api/v1/documents/{id}/participants`). The **FOP** (owner) signing state is read from the detail's `currentUser.status` (the authenticated org is the document owner/FOP). The **client** signing state is read from the participants list (`status`, `isSignatureRequired`).

Mapping (evaluated in order):

- `archived = true` → `Act.status = deleted` and `Payment.act_id = NULL`.
- `refused = true` OR any participant `status = "rejected"` → `Act.edo_status = "refused"` (`Act.status` unchanged).
- `state = "signed"` (fast-path) → `Act.status = signed`. No participants fetch.
- `currentUser.status ≠ "signed"` (FOP has not signed) → `Act.status = sent_to_edo`, `Act.edo_status = "new"`. No participants fetch.
- `currentUser.status = "signed"` (FOP signed): fetch participants — if at least one `isSignatureRequired` participant exists AND all such participants have `status = "signed"` → `Act.status = signed`; otherwise → `Act.status = waiting_for_client_sign`.

The participants fetch SHALL occur ONLY when the FOP has already signed (the last branch), to bound API volume, and SHALL run under the existing poll concurrency throttle (`POLL_CONCURRENCY = 4`). When `currentUser` is absent (older responses / mocks), the mapper SHALL fall back to the document-level `state` (`signed → signed`; `sent → waiting_for_client_sign`; `new → sent_to_edo`), with `archived`/`refused` still taking precedence.

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

#### Scenario: Document archived in DubiDoc

- **WHEN** the detail includes `{ archived: true }` for an unfinished act
- **THEN** `Act.status` SHALL be updated to `deleted`, and `Payment.act_id` SHALL be set to `NULL`

#### Scenario: Document refused in DubiDoc

- **WHEN** the detail includes `{ refused: true }`, or a participant has `status = "rejected"`
- **THEN** `Act.edo_status` SHALL be `"refused"` and `Act.status` SHALL remain unchanged

#### Scenario: Shared mapper for cron and manual refresh

- **WHEN** either the polling cron or the manual refresh evaluates a document
- **THEN** both SHALL produce identical act-status outcomes from the same shared mapper

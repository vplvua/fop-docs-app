## MODIFIED Requirements

### Requirement: DubiDoc status mapping

The polling response SHALL be mapped to act status as follows: `status = "signed"` → `Act.status = signed`; `archived = true` → `Act.status = deleted` and `Payment.act_id = NULL`; `refused = true` → `Act.edo_status = "refused"` (Act.status remains unchanged); `status = "new"` → `Act.status = sent_to_edo` (just sent, awaiting the FOP's signature); `status = "waiting_for_contractor_sign"` → `Act.status = waiting_for_client_sign` (the FOP has signed, the client/counterparty has not); all other values → `Act.edo_status = <raw status value>` (Act.status unchanged). `Act.edo_status` is `text` type, not enum. The same mapping SHALL be applied by both the polling cron and the manual refresh, via a single shared mapper.

Covers: FR-EDO-06, FR-EDO-07.

#### Scenario: Document signed in DubiDoc

- **WHEN** polling returns `{ status: "signed" }` for an act
- **THEN** `Act.status` SHALL be updated to `signed`

#### Scenario: FOP signed, awaiting the client

- **WHEN** polling returns `{ status: "waiting_for_contractor_sign" }` for an act with `status = sent_to_edo`
- **THEN** `Act.status` SHALL be updated to `waiting_for_client_sign` and `Act.edo_status` SHALL be `"waiting_for_contractor_sign"`

#### Scenario: Just sent, awaiting the FOP

- **WHEN** polling returns `{ status: "new" }` for an act
- **THEN** `Act.status` SHALL remain `sent_to_edo` and `Act.edo_status` SHALL be `"new"`

#### Scenario: Document archived in DubiDoc

- **WHEN** polling returns `{ archived: true }` for an act
- **THEN** `Act.status` SHALL be updated to `deleted`, and `Payment.act_id` SHALL be set to `NULL`

#### Scenario: Document refused in DubiDoc

- **WHEN** polling returns `{ refused: true }` for an act
- **THEN** `Act.edo_status` SHALL be `"refused"`, `Act.status` SHALL remain unchanged

#### Scenario: Intermediate DubiDoc status

- **WHEN** polling returns `{ status: "sent_for_sign" }` for an act
- **THEN** `Act.edo_status` SHALL be `"sent_for_sign"`, `Act.status` SHALL remain unchanged

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

### Requirement: Manual status refresh from act card

The admin SHALL be able to trigger a single `GET /api/v1/documents/{edo_doc_id}` from the act detail page via an "Оновити статус" button, available while the act is still pending in DubiDoc (`status ∈ {sent_to_edo, waiting_for_client_sign}`). The result SHALL be mapped using the same shared mapper as the polling cron.

Covers: FR-EDO-11.

#### Scenario: Manual refresh updates status

- **WHEN** the admin clicks "Оновити статус" on an act with `status = sent_to_edo`
- **THEN** the system SHALL call `GET /documents/{edo_doc_id}` and update `Act.status` / `Act.edo_status` accordingly

#### Scenario: Manual refresh on an awaiting-client act

- **WHEN** the admin clicks "Оновити статус" on an act with `status = waiting_for_client_sign` and the client has since signed
- **THEN** `Act.status` SHALL be updated to `signed`

### Requirement: Dashboard DubiDoc poll trigger

The dashboard SHALL include a "Опитати статуси Дубідок" button that triggers the same polling logic as the cron, outside of the cron schedule.

Covers: FR-UI-03.

#### Scenario: Manual poll from dashboard

- **WHEN** the admin clicks "Опитати статуси Дубідок" on the dashboard
- **THEN** the system SHALL poll DubiDoc for all acts with `status ∈ {sent_to_edo, waiting_for_client_sign} AND edo_provider = dubidoc` and update statuses

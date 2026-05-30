## MODIFIED Requirements

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

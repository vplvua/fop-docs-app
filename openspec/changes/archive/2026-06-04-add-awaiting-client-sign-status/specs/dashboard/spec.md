## MODIFIED Requirements

### Requirement: Attention counters

The dashboard SHALL display four counters: "Платежів у черзі" (payments with `status = in_queue`), "Платежів на апрув" (payments with `status = awaiting_review`), "Актів очікують підпису" (acts with `status = sent_to_edo` — sent, awaiting the FOP's signature), and "Очікують підпису клієнта" (acts with `status = waiting_for_client_sign` — the FOP has signed, the client has not). Each counter SHALL link to the corresponding filtered surface.

Covers: FR-UI-02.

#### Scenario: Counters reflect current data

- **WHEN** there are 3 payments `in_queue`, 2 `awaiting_review`, 1 act `sent_to_edo`, and 4 acts `waiting_for_client_sign`
- **THEN** the dashboard SHALL show 3, 2, 1, and 4 respectively

#### Scenario: Counter links to its surface

- **WHEN** the admin clicks the "Платежів у черзі" counter
- **THEN** the dashboard SHALL navigate to `/queue?tab=in_queue`

#### Scenario: Acts counter links to filtered acts

- **WHEN** the admin clicks the "Актів очікують підпису" counter
- **THEN** the dashboard SHALL navigate to `/acts?status=sent_to_edo`

#### Scenario: Awaiting-client counter links to filtered acts

- **WHEN** the admin clicks the "Очікують підпису клієнта" counter
- **THEN** the dashboard SHALL navigate to `/acts?status=waiting_for_client_sign`

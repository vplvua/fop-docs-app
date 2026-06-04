## ADDED Requirements

### Requirement: Act awaiting-client-signature status

The system SHALL represent the state «FOP has signed in DubiDoc, the client has not yet» as a distinct act status `waiting_for_client_sign`, separate from `sent_to_edo`. It applies only to `edo_provider = dubidoc` acts and is reached automatically by the DubiDoc status mapping (raw `waiting_for_contractor_sign`); the FOP never sets it by hand. `sent_to_edo` retains its badge «Відправлено в ЕДО» and now means specifically «надіслано, очікує мого підпису».

The act detail page and the acts list SHALL render `waiting_for_client_sign` with the badge «Очікує підпису клієнта», visually distinct from `sent_to_edo`. The value SHALL be selectable in the acts-list status filter and SHALL be ordered between `sent_to_edo` and `signed` in `STATUS_ORDER`. An act in `waiting_for_client_sign` SHALL remain non-editable and non-deletable (an external DubiDoc document exists), consistent with `sent_to_edo`.

Covers: FR-UI-06, FR-UI-07.

#### Scenario: Badge on the act detail page

- **WHEN** the admin views an act with `status = waiting_for_client_sign`
- **THEN** the status badge SHALL read «Очікує підпису клієнта», distinct from the «Відправлено в ЕДО» badge

#### Scenario: Filter the acts list by awaiting-client

- **WHEN** the admin selects the status filter for `waiting_for_client_sign`
- **THEN** only acts whose `status = waiting_for_client_sign` SHALL be displayed

#### Scenario: Awaiting-client act is locked

- **WHEN** the admin opens an act with `status = waiting_for_client_sign`
- **THEN** the service-description edit and any delete/cancel action SHALL be unavailable, as for a `sent_to_edo` act

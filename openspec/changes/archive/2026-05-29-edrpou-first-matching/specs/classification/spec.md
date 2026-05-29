## ADDED Requirements

### Requirement: Client matching — EDRPOU-first

The classifier SHALL identify the client primarily by `payment.payer_legal_id` (payer EDRPOU). The contract number SHALL be used only as a secondary discriminator among clients that share the same EDRPOU, and SHALL NEVER reassign a payment to a client with a different `legal_id`.

For non-transit payments the classifier SHALL resolve as follows:

1. Let `candidates` be all clients with `legal_id == payment.payer_legal_id`.
2. Let `activeCandidates` be the subset of `candidates` with `auto_act_disabled == false`.
3. If `candidates` is empty → `in_queue(no_match)`.
4. If `activeCandidates` has exactly one client → that client is matched.
5. If `activeCandidates` has more than one client → the classifier SHALL attempt to discriminate by contract: if exactly one active candidate has a `contract.number` present in `parsed_contract_numbers`, that client is matched; otherwise → `awaiting_review(multiple_clients_same_edrpou)` with the active candidates carried as selectable options.
6. If `activeCandidates` is empty but `candidates` is not (only archived clients share the EDRPOU) → `awaiting_review(auto_act_disabled)`; `client_id` SHALL be set to the archived candidate when exactly one exists, otherwise left null.

Covers: FR-CLASS-05, FR-CLASS-07.

#### Scenario: Single active client with matching EDRPOU

- **WHEN** `payer_legal_id = "45651721"` matches exactly one client with `auto_act_disabled = false`
- **THEN** that client SHALL be matched regardless of the contract number written in the purpose

#### Scenario: Wrong contract number does not steal the payment

- **WHEN** the purpose references contract `557355` belonging to an archived duplicate, but exactly one active client with the same `legal_id` exists (contract `557352`)
- **THEN** the active client SHALL be matched, and the archived duplicate SHALL be ignored

#### Scenario: No client with payer EDRPOU

- **WHEN** no client has `legal_id == payer_legal_id`
- **THEN** payment SHALL have `status = in_queue`, `classification_reason` containing `no_match`

#### Scenario: Multiple active clients, contract resolves one

- **WHEN** two active clients share `legal_id` and exactly one of them has a `contract.number` present in `parsed_contract_numbers`
- **THEN** that one client SHALL be matched

#### Scenario: Multiple active clients, contract does not resolve

- **WHEN** two or more active clients share `legal_id` and the contract number does not uniquely identify exactly one of them
- **THEN** payment SHALL have `status = awaiting_review`, `classification_reason` containing `multiple_clients_same_edrpou`, and the active same-EDRPOU clients SHALL be available as selectable options

### Requirement: Manual client selection is constrained to the payer EDRPOU

When the admin manually selects/links a client for a payment (resolving `multiple_clients_same_edrpou` or otherwise reassigning), the server action SHALL accept only a client whose `legal_id` equals `payment.payer_legal_id` (for non-transit payments) or, for transit payments, a client identified by a parsed contract number. The action SHALL reject any client with a different EDRPOU. After a valid selection, the classifier SHALL continue the pipeline (service type → completeness → price → act) for the chosen client, respecting `auto_act_disabled` and `edo_provider`.

Covers: FR-CLASS-07.

#### Scenario: Selecting an active same-EDRPOU client resolves the payment

- **WHEN** a payment is `awaiting_review(multiple_clients_same_edrpou)` and the admin selects one of the active same-EDRPOU clients
- **THEN** the payment SHALL proceed through the remaining pipeline for that client (creating an act if all checks pass)

#### Scenario: Selecting a client with a different EDRPOU is rejected

- **WHEN** the admin attempts to link a client whose `legal_id` differs from `payment.payer_legal_id` (non-transit)
- **THEN** the server action SHALL reject the request and SHALL NOT change the payment's client

## REMOVED Requirements

### Requirement: Client matching — two-factor verification

**Reason**: Superseded by EDRPOU-first matching (revises ADR D-009). Contract-number-first matching let a wrong contract number written by the payer silently steal a payment onto the wrong same-EDRPOU record.

**Migration**: Replaced by the new requirement "Client matching — EDRPOU-first". The `ambiguous_client` reason (contract matched but EDRPOU differed) no longer arises, because matching now anchors on the payer EDRPOU; cross-EDRPOU contract matches are never made. Existing `in_queue(ambiguous_client)` / `awaiting_review` payments should be re-classified after deploy.

## MODIFIED Requirements

### Requirement: Transit EDRPOU bypass

For payments where `payer_legal_id` is in `Settings.transit_edrpou_list`, client matching SHALL use only the contract number, without verifying `legal_id`. The candidate set SHALL be restricted to active clients (`auto_act_disabled = false`). If the contract number identifies exactly one active client → matched. If it identifies more than one active client → `awaiting_review(multiple_clients_same_edrpou)` with those clients as selectable options. If it identifies no active client → `in_queue(no_match)` (or `awaiting_review(auto_act_disabled)` when only an archived client matches the contract).

Covers: FR-CLASS-06.

#### Scenario: Transit payment matched by contract only

- **WHEN** `payer_legal_id = "14360570"` (in transit list) and contract number `556770` matches exactly one active client
- **THEN** the client SHALL be matched regardless of the client's `legal_id`

#### Scenario: Transit payment with no contract match

- **WHEN** `payer_legal_id = "14360570"` (in transit list) but no active client matches the contract
- **THEN** payment SHALL have `status = in_queue`, `classification_reason` containing `no_match`

### Requirement: Multiple contracts detection

The classifier SHALL block on multiple contract numbers only when the contract number is actually used as a discriminator. If the payer EDRPOU resolves to exactly one active client, multiple parsed contract numbers SHALL be treated as informational and SHALL NOT block classification. Otherwise (transit payment, or more than one active client shares the payer EDRPOU), when more than one distinct contract number is found the payment SHALL be routed to `status = in_queue` with `classification_reason = multiple_contracts`.

Covers: FR-CLASS-04.

#### Scenario: Multiple contracts but EDRPOU resolves one active client

- **WHEN** the purpose yields `["556770", "556771"]` but exactly one active client has `legal_id == payer_legal_id`
- **THEN** the payment SHALL be classified to that active client and SHALL NOT be routed to `multiple_contracts`

#### Scenario: Multiple contracts where contract is the discriminator

- **WHEN** the contract number must discriminate (transit payment or several active clients share the EDRPOU) and parsing yields `["556770", "556771"]`
- **THEN** payment SHALL have `status = in_queue`, `classification_reason` containing `multiple_contracts`

### Requirement: Auto-act disabled check

If the matched client has `auto_act_disabled = true`, the payment SHALL be routed to `status = awaiting_review` with `classification_reason` containing `auto_act_disabled`, and the act SHALL NOT be auto-generated. Archived clients (`auto_act_disabled = true`) SHALL NOT be auto-matched in preference to an active client sharing the same EDRPOU, and SHALL NOT appear as selectable options for manual selection.

Covers: FR-CLASS-08.

#### Scenario: Client with auto_act_disabled

- **WHEN** the matched client has `auto_act_disabled = true`
- **THEN** payment SHALL have `status = awaiting_review`, `classification_reason` containing `auto_act_disabled`

#### Scenario: Single archived client for the EDRPOU (exclusion list)

- **WHEN** the payer EDRPOU matches exactly one client and that client has `auto_act_disabled = true` (e.g. an exclusion-list client)
- **THEN** payment SHALL have `status = awaiting_review`, `classification_reason` containing `auto_act_disabled`

#### Scenario: Active client takes priority over archived sibling

- **WHEN** the payer EDRPOU matches one active client and one or more archived clients
- **THEN** the active client SHALL be matched and the archived clients SHALL be ignored

### Requirement: Payment card shows classification actions

The payment detail page (`/payments/[id]`) SHALL display an action panel: for `received`/`awaiting_review`/`in_queue` — "Класифікувати" and "Пропустити" buttons; for `in_queue` — the classification reason with contextual guidance; for `classified` — a read-only link to the created act; for `skipped` — a "Пропущено" badge. For `awaiting_review` with `classification_reason` containing `multiple_clients_same_edrpou`, the panel SHALL show a warning that several active clients share the payer EDRPOU and a selector listing only those active clients; selecting one SHALL link the payment to that client and continue classification.

#### Scenario: Action panel for in_queue payment

- **WHEN** the admin views a payment with `status = in_queue` and `classification_reason` containing `no_match`
- **THEN** the page SHALL show "Класифікувати" and "Пропустити" buttons, and guidance text explaining the payment could not be matched to a client

#### Scenario: Action panel for classified payment

- **WHEN** the admin views a payment with `status = classified` and `act_id` set
- **THEN** the page SHALL show a read-only summary with a link to the act

#### Scenario: Selector for multiple clients with same EDRPOU

- **WHEN** the admin views a payment with `status = awaiting_review` and `classification_reason` containing `multiple_clients_same_edrpou`
- **THEN** the page SHALL show a warning and a selector of the active clients sharing the payer EDRPOU, and archived clients SHALL NOT be listed

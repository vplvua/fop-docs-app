## MODIFIED Requirements

### Requirement: Classification triggers on received payments and manual reclassify

The system SHALL run classification on every payment with `status = received` immediately after ingest. The system SHALL also allow re-running classification on payments with `status = awaiting_review` or `status = in_queue` via a server action. Payments with `status = classified` SHALL NOT be reclassifiable (FR-CLASS-17): re-running classification SHALL NOT create a second act or modify the existing classification. Invoking the classify server action on a payment that is already `classified` SHALL be treated as an idempotent no-op that **succeeds** (the panel refreshes to the read-only classified view), not an error. Invoking it on a `skipped` payment SHALL still be rejected (skip is terminal for classification — FR-CLASS-18).

Covers: FR-CLASS-01.

#### Scenario: Auto-classify after ingest

- **WHEN** a new payment is inserted with `status = received` during PrivatBank polling
- **THEN** the classifier SHALL run automatically and update the payment status to one of: `classified`, `awaiting_review`, or `in_queue`

#### Scenario: Manual reclassify from in_queue

- **WHEN** the admin triggers reclassification on a payment with `status = in_queue`
- **THEN** the classifier SHALL re-run and the payment status SHALL be updated based on current data

#### Scenario: Classify on an already-classified payment is a no-op success

- **WHEN** the classify server action is invoked on a payment with `status = classified` (e.g. a stale page render after a fire-and-forget import classification, or a concurrent trigger raced the manual button)
- **THEN** the action SHALL succeed without creating a second act and without raising an error, and the payment SHALL keep its existing `act_id`; the panel SHALL show the read-only classified view (the linked act)

### Requirement: Classification pipeline follows 8-step order

The classifier SHALL execute steps in order: (1) parse contract numbers from purpose, (2) dedup + multiple_contracts check, (3) client matching, (4) auto_act_disabled check, (5) edo_provider check, (6) service_type detection, (7) client data completeness check, (8) price resolve + quantity calculation. The entire classification SHALL run inside a Postgres transaction with `SELECT ... FOR UPDATE` on the payment row. When the locked payment row is already in a terminal classification state (`classified` or `skipped`), the run SHALL be an idempotent no-op: it SHALL NOT execute the pipeline, SHALL NOT create an act, SHALL NOT modify the payment, SHALL NOT trigger PDF generation, and SHALL NOT raise an error.

Covers: FR-CLASS-02, FR-CLASS-15.

#### Scenario: Happy path — all steps succeed

- **WHEN** a payment matches a client with a valid contract, complete data, and correct amount
- **THEN** the payment SHALL transition to `status = classified` with `act_id` pointing to a new act stub, and `service_type`, `unit_price`, `quantity`, `quantity_unit` SHALL be populated

#### Scenario: Concurrent classification is serialized

- **WHEN** two classification attempts run simultaneously for the same payment
- **THEN** the second attempt SHALL wait for the first transaction to complete (via `FOR UPDATE`), SHALL observe the now-`classified` status, and SHALL complete as an idempotent no-op — creating no second act and raising no error

#### Scenario: Redundant trigger on an already-final payment is a no-op

- **WHEN** classification is triggered (manually or via a background fire-and-forget call) on a payment whose status is already `classified` or `skipped`
- **THEN** exactly one act (or zero, for `skipped`) SHALL exist for that payment, the payment row SHALL be unchanged, no PDF generation SHALL be triggered, and the call SHALL resolve without throwing

## ADDED Requirements

### Requirement: Manual external payments

The system SHALL allow a payment to be recorded with `source = 'manual_external'` for money that did not arrive through PrivatBank (a different bank, or a pre-launch payment). Such a payment SHALL carry a synthetic unique `bank_transaction_id` of the form `manual:{uuid}`, an optional `bank_label` naming the originating bank, and SHALL be created as part of manual act creation (see the `manual-acts` capability). Manual external payments SHALL NOT participate in the PrivatBank `REF+REFN` id space and SHALL NOT be produced or mutated by the PrivatBank poll.

Covers: FR-PAY-13 (new).

#### Scenario: Manual external payment recorded

- **WHEN** a manual act is created for money received in another bank
- **THEN** a `payments` row SHALL be created with `source = 'manual_external'`, a `manual:{uuid}` `bank_transaction_id`, and the supplied `bank_label`

#### Scenario: Poll never touches manual payments

- **WHEN** the PrivatBank poll runs
- **THEN** it SHALL only insert `source = 'privatbank'` rows and SHALL NOT update or duplicate any `source = 'manual_external'` row, since their `bank_transaction_id` values are outside the PrivatBank id space

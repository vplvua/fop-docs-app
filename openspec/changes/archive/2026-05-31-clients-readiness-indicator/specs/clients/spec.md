## ADDED Requirements

### Requirement: Client act-readiness indicator

The `/clients` list SHALL show a per-row act-readiness indicator that tells the operator, at a glance, whether a client is ready to have an act generated. The indicator SHALL be a colored status dot with three levels, derived by reusing the completeness check (`checkCompleteness`) against the client and its contract:

- **Red** — the client has no contract, **or** a required client field is missing (`email`, `address`, `bank_name`, `bank_account`). The client cannot have an act generated.
- **Yellow** — a contract is present and all required client fields are filled, but a conditional field needed for the access service is missing (`apartments_count` with no `access_price_override`).
- **Green** — everything required to create an act is present.

The indicator SHALL expose, via a tooltip and an accessible label, the specific missing items in Ukrainian. Contract and required-field checks are service-independent; the conditional `apartments_count` check (yellow) reflects the access service.

Covers: FR-CLI-09.

#### Scenario: Red — no contract

- **WHEN** a client has no contract
- **THEN** its readiness dot SHALL be red and the tooltip SHALL indicate the missing contract

#### Scenario: Red — missing required field

- **WHEN** a client has a contract but is missing a required field (e.g. bank account)
- **THEN** its readiness dot SHALL be red and the tooltip SHALL list the missing field(s)

#### Scenario: Yellow — missing apartments_count

- **WHEN** a client has a contract and all required fields, but no `apartments_count` and no `access_price_override`
- **THEN** its readiness dot SHALL be yellow and the tooltip SHALL indicate the missing apartments count

#### Scenario: Green — ready

- **WHEN** a client has a contract, all required fields, and either an `apartments_count` or an `access_price_override`
- **THEN** its readiness dot SHALL be green

#### Scenario: Tooltip lists missing items

- **WHEN** the admin hovers (or focuses) a non-green readiness dot
- **THEN** a tooltip SHALL list the specific missing items in Ukrainian

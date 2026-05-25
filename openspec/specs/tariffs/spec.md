# tariffs Specification

## Purpose

Tariff grid and SMS price management with price resolver functions. Admin CRUD for access tariffs (ranged + catch-all) and SMS prices. Resolver functions determine unit_price for payments during classification. Covers FR-TAR-01 through FR-TAR-10, FR-SET-01, FR-SET-02.

## Requirements

### Requirement: Tariff grid with catch-all invariant

The system SHALL maintain a `tariffs` table with fields: `apartments_min` (integer, NOT NULL), `apartments_max` (integer, nullable — NULL means catch-all), `price` (decimal, NOT NULL), `effective_from` (date, NOT NULL). The grid MUST always contain at least one catch-all rule (`apartments_max IS NULL`). Deletion of the last catch-all SHALL be blocked.

Covers: FR-TAR-01, FR-TAR-02.

#### Scenario: Grid contains one catch-all

- **WHEN** the tariff grid has exactly one catch-all rule and the admin attempts to delete it
- **THEN** the system SHALL reject the deletion with an error: "Не можна видалити останнє базове правило"

#### Scenario: Grid contains multiple catch-alls

- **WHEN** the tariff grid has two catch-all rules (different `effective_from`) and the admin deletes one
- **THEN** the deletion SHALL succeed and one catch-all SHALL remain

### Requirement: Admin can create a tariff rule

The system SHALL allow the admin to create a new tariff rule via `/settings/tariffs`. Required fields: `price`, `effective_from`. Optional fields: `apartments_min` (default 0), `apartments_max` (nullable). Price changes are modeled as new rows, not edits to existing rows.

Covers: FR-TAR-01, FR-TAR-03, FR-SET-01.

#### Scenario: Create a ranged tariff

- **WHEN** the admin creates a tariff with `apartments_min = 50`, `apartments_max = 100`, `price = 300.00`, `effective_from = "2025-06-01"`
- **THEN** a `tariffs` row SHALL be created with those exact values

#### Scenario: Create a catch-all tariff

- **WHEN** the admin creates a tariff with `apartments_min = 0`, `apartments_max` left empty, `price = 250.00`, `effective_from = "2025-07-01"`
- **THEN** a `tariffs` row SHALL be created with `apartments_max = NULL`

### Requirement: Admin can delete a tariff rule

The system SHALL allow the admin to delete a tariff rule, subject to the catch-all invariant. There is no edit action — to change a price, the admin creates a new rule with a later `effective_from`.

Covers: FR-TAR-03, FR-SET-01.

#### Scenario: Delete a ranged rule

- **WHEN** the admin deletes a tariff with `apartments_min = 50`, `apartments_max = 100`
- **THEN** the row SHALL be removed from the `tariffs` table

#### Scenario: Delete blocked for last catch-all

- **WHEN** the tariff grid has exactly one catch-all and the admin attempts to delete it
- **THEN** the system SHALL reject deletion with an error

### Requirement: Access price resolution

The function `resolveAccessPrice(client, paymentDate)` SHALL resolve the access price using the following priority:

1. If `client.access_price_override` is not null, return it (FR-TAR-07).
2. Find all tariff rules where `effective_from ≤ paymentDate`.
3. Among matching rules, find those where `apartments_min ≤ client.apartments_count ≤ apartments_max` (ranged) or `apartments_max IS NULL` (catch-all).
4. Prefer ranged over catch-all. Among ranged, prefer narrower range. Among equal ranges, prefer latest `effective_from`.
5. Return `price` of the selected rule.

Covers: FR-TAR-04, FR-TAR-07, FR-TAR-09.

#### Scenario: Client has override

- **WHEN** client has `access_price_override = 500.00` and tariff grid has catch-all `price = 200`
- **THEN** `resolveAccessPrice` SHALL return `500.00`

#### Scenario: Ranged rule matches

- **WHEN** client has `apartments_count = 70`, no override, and tariff grid has ranged rule `apartments_min=50, apartments_max=100, price=300` and catch-all `price=200`, both with `effective_from ≤ paymentDate`
- **THEN** `resolveAccessPrice` SHALL return `300.00` (ranged preferred over catch-all)

#### Scenario: Only catch-all matches

- **WHEN** client has `apartments_count = 150`, no override, and tariff grid has ranged rule `apartments_min=50, apartments_max=100, price=300` and catch-all `price=200`
- **THEN** `resolveAccessPrice` SHALL return `200.00` (catch-all fallback)

#### Scenario: Multiple effective_from versions

- **WHEN** tariff grid has catch-all `price=200, effective_from=2024-01-01` and catch-all `price=250, effective_from=2025-01-01`, and `paymentDate = 2025-06-15`
- **THEN** `resolveAccessPrice` SHALL return `250.00` (latest effective_from ≤ paymentDate)

#### Scenario: Payment date before latest effective_from

- **WHEN** tariff grid has catch-all `price=200, effective_from=2024-01-01` and catch-all `price=250, effective_from=2025-01-01`, and `paymentDate = 2024-06-15`
- **THEN** `resolveAccessPrice` SHALL return `200.00` (only 2024-01-01 rule is effective)

### Requirement: SMS price resolution

The function `resolveSmsPrice(paymentDate)` SHALL return the `price` from the `sms_prices` row with the latest `effective_from ≤ paymentDate`. The override on client does NOT apply to SMS prices.

Covers: FR-TAR-05, FR-TAR-06, FR-TAR-08.

#### Scenario: Single SMS price

- **WHEN** `sms_prices` has one row `price=1.40, effective_from=2024-01-01` and `paymentDate = 2025-03-15`
- **THEN** `resolveSmsPrice` SHALL return `1.40`

#### Scenario: Multiple SMS price versions

- **WHEN** `sms_prices` has `price=1.40, effective_from=2024-01-01` and `price=1.80, effective_from=2025-01-01`, and `paymentDate = 2025-06-15`
- **THEN** `resolveSmsPrice` SHALL return `1.80`

#### Scenario: No applicable SMS price

- **WHEN** `sms_prices` has `price=1.40, effective_from=2025-01-01` and `paymentDate = 2024-06-15`
- **THEN** `resolveSmsPrice` SHALL return `null` (no rule effective at that date)

### Requirement: Admin can manage SMS prices

The system SHALL allow the admin to create and delete SMS price entries via `/settings/sms-prices`. Each entry has `price` (decimal, required) and `effective_from` (date, required). There is no edit action.

Covers: FR-TAR-05, FR-SET-02.

#### Scenario: Create an SMS price

- **WHEN** the admin creates an SMS price with `price = 1.80`, `effective_from = "2025-07-01"`
- **THEN** a `sms_prices` row SHALL be created with those values

#### Scenario: Delete an SMS price

- **WHEN** the admin deletes an SMS price entry
- **THEN** the row SHALL be removed from the `sms_prices` table

### Requirement: Seed data

The system SHALL ship with starter data: one catch-all tariff (`apartments_min=0, apartments_max=NULL, price=200, effective_from='2024-01-01'`) and one SMS price (`price=1.40, effective_from='2024-01-01'`). Seed is idempotent via `ON CONFLICT DO NOTHING`.

Covers: FR-TAR-10.

#### Scenario: Seed applied on fresh database

- **WHEN** the migration runs on an empty database
- **THEN** the `tariffs` table SHALL contain one catch-all row and `sms_prices` SHALL contain one row

#### Scenario: Seed re-run is idempotent

- **WHEN** the seed migration runs again on a database that already has the starter data
- **THEN** no duplicate rows SHALL be created

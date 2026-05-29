## ADDED Requirements

### Requirement: Integration health banners

The dashboard (`/`) SHALL render a health banner for each tracked integration — ПриватБанк, Дубідок, and "Моє ОСББ" — sourced from `integration_health`. Each banner SHALL show a healthy (✓) or failing (✗) indicator, the last successful interaction timestamp, and, when failing, the last error message and error time. An integration with no `integration_health` row SHALL render as "ще не запускалось" rather than being omitted.

Covers: FR-UI-01.

#### Scenario: Healthy integration

- **WHEN** an integration's `last_success_at` is set and there is no `last_error_at` newer than it
- **THEN** its banner SHALL show the ✓ state and the last successful timestamp

#### Scenario: Failing integration

- **WHEN** an integration's `last_error_at` is strictly newer than its `last_success_at`
- **THEN** its banner SHALL show the ✗ state, the last error message, and the error timestamp

#### Scenario: Integration that never ran

- **WHEN** there is no `integration_health` row for an integration
- **THEN** its banner SHALL still render with a "ще не запускалось" state

### Requirement: Attention counters

The dashboard SHALL display three counters: "Платежів у черзі" (payments with `status = in_queue`), "Платежів на апрув" (payments with `status = awaiting_review`), and "Актів очікують підпису" (acts with `status = sent_to_edo`). Each counter SHALL link to the corresponding filtered surface.

Covers: FR-UI-02.

#### Scenario: Counters reflect current data

- **WHEN** there are 3 payments `in_queue`, 2 `awaiting_review`, and 1 act `sent_to_edo`
- **THEN** the dashboard SHALL show 3, 2, and 1 respectively

#### Scenario: Counter links to its surface

- **WHEN** the admin clicks the "Платежів у черзі" counter
- **THEN** the dashboard SHALL navigate to `/queue?tab=in_queue`

#### Scenario: Acts counter links to filtered acts

- **WHEN** the admin clicks the "Актів очікують підпису" counter
- **THEN** the dashboard SHALL navigate to `/acts?status=sent_to_edo`

### Requirement: Manual integration triggers

The dashboard SHALL provide three manual-trigger buttons: "Синхронізувати ПриватБанк зараз", "Синхронізувати Моє ОСББ зараз", and "Опитати статуси Дубідок". Each SHALL invoke its existing server action and report a short result summary; after a successful run the dashboard data SHALL refresh.

Covers: FR-UI-03.

#### Scenario: PrivatBank manual poll

- **WHEN** the admin clicks "Синхронізувати ПриватБанк зараз"
- **THEN** the PrivatBank poll action SHALL run and the dashboard SHALL show how many payments were ingested

#### Scenario: Dashboard refreshes after a manual run

- **WHEN** a manual trigger completes successfully
- **THEN** the banners and counters SHALL reflect the post-run state without a full page reload

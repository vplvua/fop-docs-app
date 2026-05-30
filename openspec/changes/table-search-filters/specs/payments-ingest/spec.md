## MODIFIED Requirements

### Requirement: Payments list page

The system SHALL provide a `/payments` page displaying payments in a table with columns: payment_date, amount (thousands-separated, currency unit in the header), purpose (truncated), payer_name, status (badge), created_at. The list SHALL support:

- **Status** filter (existing).
- **Date-range** filter on `payment_date` — presets (today / this & last week / this & last month / this & last quarter) plus a custom from/to range, default no date filter, per the `data-tables` date-range behavior.
- **Text search** on `payer_name` and `purpose` (case-insensitive substring), and on the linked client's `moeosbb_user_id` (exact, when the query is all digits) via `payments.client_id → clients`. Searching by MoeOSBB id matches only payments already linked to a client (`client_id` set during classification); unlinked payments are not surfaced by id.

Search and filters apply across the whole dataset and combine with each other, with server-side pagination and sorting per `data-tables`.

Covers: FR-PAY-01 (visibility).

#### Scenario: View payments list

- **WHEN** the admin navigates to `/payments`
- **THEN** payments SHALL be displayed sorted by `payment_date` descending (page 1)

#### Scenario: Filter by status

- **WHEN** the admin selects status filter "received"
- **THEN** only payments with `status = 'received'` SHALL be displayed

#### Scenario: Filter by date range

- **WHEN** the admin selects the "Минулий місяць" preset
- **THEN** only payments whose `payment_date` falls in the previous calendar month (Europe/Kyiv) SHALL be displayed

#### Scenario: Search by payer name

- **WHEN** the admin searches a payer name fragment
- **THEN** payments whose `payer_name` contains that fragment (case-insensitive) SHALL be displayed

#### Scenario: Search by linked MoeOSBB id

- **WHEN** the admin searches a MoeOSBB id and a payment is linked to the client with that id
- **THEN** that payment SHALL be displayed; payments not yet linked to any client SHALL NOT be matched by id

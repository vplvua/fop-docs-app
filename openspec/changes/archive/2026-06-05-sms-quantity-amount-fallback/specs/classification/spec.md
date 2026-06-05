## MODIFIED Requirements

### Requirement: SMS price and quantity validation

For `service_type = sms`: the classifier SHALL resolve `unit_price` via `resolveSmsPrice` and determine quantity as follows. First it SHALL attempt to parse an explicit quantity from `purpose` text. If an explicit quantity is parsed, it SHALL route to `in_queue(sms_quantity_mismatch)` when `parsed_quantity × unit_price != amount`, otherwise classify with `quantity = parsed_quantity`. If no explicit quantity can be parsed, the classifier SHALL derive the quantity from `amount / unit_price` and classify only when the quotient is a whole number (`amount % unit_price == 0`) and `unit_price > 0` and the quotient is positive; otherwise it SHALL route to `in_queue(sms_quantity_mismatch)`. `quantity_unit` SHALL be `"шт."`.

Covers: FR-CLASS-14.

#### Scenario: SMS quantity parsed and validated

- **WHEN** purpose contains "у кількості 100", `sms_unit_price = 1.40`, and `amount = 140.00`
- **THEN** `quantity` SHALL be `100`, `quantity_unit` SHALL be `"шт."`, `unit_price` SHALL be `1.40`

#### Scenario: SMS quantity not stated but amount divides cleanly

- **WHEN** purpose contains no recognizable quantity pattern (e.g. "ОПЛАТА СМС ДОГОВІР №557113"), `sms_unit_price = 1.40`, and `amount = 1120.00`
- **THEN** `quantity` SHALL be `800` (derived from `amount / unit_price`), `quantity_unit` SHALL be `"шт."`, and the payment SHALL be classified

#### Scenario: SMS quantity not stated and amount is not a clean multiple

- **WHEN** purpose contains no recognizable quantity pattern, `sms_unit_price = 1.40`, and `amount = 145.00` (145 / 1.40 = 103.57…)
- **THEN** payment SHALL have `status = in_queue`, `classification_reason` containing `sms_quantity_mismatch`

#### Scenario: SMS quantity × price does not match amount

- **WHEN** parsed quantity is `100`, `sms_unit_price = 1.40`, but `amount = 150.00`
- **THEN** payment SHALL have `status = in_queue`, `classification_reason` containing `sms_quantity_mismatch`

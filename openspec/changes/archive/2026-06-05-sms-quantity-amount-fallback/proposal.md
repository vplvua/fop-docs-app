## Why

Real SMS payments from clients frequently carry no explicit message count in the
purpose text (e.g. `ОПЛАТА СМС ДОГОВІР №557113 БЕЗ ПДВ`). Today the classifier can
only read an SMS quantity from the text, so every such payment is forced into
`in_queue(sms_quantity_mismatch)` for manual handling — even when the amount divides
cleanly by the SMS unit price (1120.00 / 1.40 = 800). This is avoidable manual work,
and the queue UI already shows the would-be quantity ("Поділ суми на ціну"), which
makes the rejection look like a bug to the operator.

## What Changes

- When the purpose text contains **no** parseable SMS quantity, the classifier
  derives the quantity from `amount / sms_unit_price` and classifies automatically
  **only when the quotient is a whole number** (clean-division reading, mirroring the
  existing access-quantity logic).
- When the purpose text **does** contain an explicit quantity, behavior is unchanged:
  the strict `parsed_quantity × unit_price == amount` check still applies.
- Non-whole quotients, zero/non-positive unit price, and explicit-but-mismatching
  quantities continue to route to `in_queue(sms_quantity_mismatch)`.

## Capabilities

### New Capabilities

<!-- none -->

### Modified Capabilities

- `classification`: the "SMS price and quantity validation" requirement changes — an
  unparseable quantity is no longer an automatic mismatch; it falls back to a
  clean-division reading of `amount / unit_price`.

## Impact

- Code: `lib/classification/resolve-quantity.ts` (`resolveSmsQuantity`) — already
  implemented.
- Tests: `tests/unit/classification/resolve-quantity.test.ts`,
  `tests/unit/classification/classify.test.ts` — already updated.
- No DB, API, or migration impact. Behavior-only change to the classification
  pipeline; previously queued SMS payments with clean amounts will now classify
  automatically on re-run.

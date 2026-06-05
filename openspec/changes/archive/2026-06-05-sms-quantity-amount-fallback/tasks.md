## 1. Implementation

- [x] 1.1 Add `amount / unit_price` clean-division fallback to `resolveSmsQuantity` in `lib/classification/resolve-quantity.ts`, applied only when `parseSmsQuantity` returns `null`; guard `unit_price > 0` and a positive whole-number quotient, else `sms_quantity_mismatch`.
- [x] 1.2 Keep the strict `parsed_quantity × unit_price == amount` check for explicitly stated quantities (unchanged path).

## 2. Tests

- [x] 2.1 `tests/unit/classification/resolve-quantity.test.ts`: add cases for derived quantity (1120/1.40 = 800), non-clean amount → mismatch, and zero price → mismatch; update the previously "unparseable → mismatch" case.
- [x] 2.2 `tests/unit/classification/classify.test.ts`: update the unparseable-quantity case to a non-divisible amount, and add an end-to-end case classifying an SMS payment via `amount / price`.

## 3. Quality gate

- [x] 3.1 Run `npm run qa` (lint → format:check → typecheck → test:run → build → openspec validate) and confirm green before archiving.

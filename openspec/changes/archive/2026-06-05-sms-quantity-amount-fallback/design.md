## Context

`resolveSmsQuantity` in `lib/classification/resolve-quantity.ts` previously had a single
path: parse an explicit quantity from the purpose text via `parseSmsQuantity` (two regex
patterns: `у кількості N` / `N шт|sms|смс`), and if `null`, immediately return
`sms_quantity_mismatch`. Most real SMS payments carry no such marker, so they were all
queued despite the amount dividing cleanly by the SMS unit price. The access-quantity path
in the same file already models a clean-division reading (`amount % unit_price == 0`), so
the asymmetry was the source of the surprise.

## Goals / Non-Goals

**Goals:**

- Auto-classify SMS payments with no stated quantity when `amount / unit_price` is a whole number.
- Preserve the strict behavior when a quantity IS stated in the text.
- Keep ambiguous cases (non-clean division, zero price) in the manual queue.

**Non-Goals:**

- Changing the SMS quantity regex patterns or `parseSmsQuantity`.
- Changing access-quantity logic, price resolution, or the act-stub build.
- Any DB/migration/UI change (the queue already displays "Поділ суми на ціну").

## Decisions

- **Fallback only when no explicit quantity is parsed.** When `parseSmsQuantity` returns a
  value we still trust the text and verify `quantity × price == amount`; a stated quantity
  that fails the math is a genuine discrepancy worth review, not something to override by
  division.
- **Reuse the access clean-division test** (`Math.round((a*100) % (p*100))/100`, tolerance
  `0.001`) rather than inventing a new float comparison, for consistency with
  `resolveAccessQuantity` and to stay within the codebase's established kopiykas rounding.
  Alternative considered: kopiykas-integer math throughout — rejected to keep the diff
  minimal and consistent with the sibling function.
- **Guard `unit_price > 0` and `quotient > 0`** so a zero/blank price or zero amount falls
  through to `sms_quantity_mismatch` instead of producing `Infinity`/`0`.

## Risks / Trade-offs

- [A coincidental clean division produces a wrong count] → SMS unit price is small and the
  amount is operator-verifiable on the act; clean division is the same heuristic already
  surfaced in the queue UI, so this only automates what an operator would approve anyway.
- [Float modulo edge cases for prices like 1.40] → Mitigated by the `×100 + Math.round`
  rounding already proven in the access path; covered by the 1120/1.40 = 800 unit test.

## Migration Plan

No deploy ordering or data migration. Behavior-only. Previously queued SMS payments with a
clean amount will classify automatically on the next classification re-run; no backfill is
required. Rollback is a straight revert of the `resolveSmsQuantity` change.

## Open Questions

None.

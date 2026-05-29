## Context

S7 (classification) shipped the full pipeline plus a per-payment resolution panel on `/payments/[id]` (`classification-panel.tsx`) and a stopgap "queue" that is really just `/payments?status=in_queue`. All resolution actions already exist and are spec-accepted in `openspec/specs/classification/spec.md`:

- `classifyPaymentAction(paymentId)` — re-run the pipeline.
- `skipPaymentAction(paymentId)` — terminal `skipped`.
- `linkPaymentClientAction(paymentId, clientId)` — link to a client (with EDRPOU/contract guardrail) then re-run.

The eight `classification_reason` values and their target statuses are fixed by the classification spec (D-041 EDRPOU-first matching). `awaiting_review` carries `auto_act_disabled`, `external_edo`, `multiple_clients_same_edrpou`; `in_queue` carries `no_match`, `multiple_contracts`, `client_incomplete`, `amount_mismatch`, `sms_quantity_mismatch`. `ambiguous_client` is legacy (D-041) and only appears on historical rows.

S12 is a **UI/UX polish slice**: build the real `/queue` over those existing actions. No pipeline changes, no DB migrations, no new server actions required for the happy path.

Constraints: single admin, UA-only copy, Next.js 16 App Router (RSC by default, `'use client'` only where interactive), `lib/` stays pure (no `next/*`), DESIGN.md tokens only (no hex/ad-hoc shades), reason copy must match the Ukrainian strings already in `classification-panel.tsx`.

## Goals / Non-Goals

**Goals:**

- One screen (`/queue`) where the admin triages the entire unresolved backlog: two tabs (`awaiting_review`, `in_queue`), grouped by `classification_reason`.
- Reason-specific inline cards so the admin resolves without navigating to each payment card; target ≤ 2 min/payment.
- Reuse the existing classification/skip/link server actions verbatim; reuse the reason-guidance copy and `ClientCandidate` shape.
- Extract the missing-field computation for `client_incomplete` into a pure, unit-tested `lib/queue/` helper (UI-on-the-fly, no DB column).
- Top-bar "Черга" nav with a pending count.

**Non-Goals:**

- No changes to the classification pipeline, reasons, or matching semantics.
- No DB migrations, no new columns, no cron, no external API calls.
- No bulk operations (multi-select resolve) — deferred to Phase 1 per `mvp-capability-plan.md` §8.
- No removal of `/payments` or `/payments/[id]`; the per-payment panel stays as a fallback.
- `amount_mismatch` / `sms_quantity_mismatch` correction = surface the computed variants + re-run/skip affordance; editing the tariff/SMS grid stays in Settings (not a queue inline form).

## Decisions

### D1. New `queue` capability vs. extending `classification`

`/queue` is a distinct user-facing surface with its own route group (`app/(queue)/queue/`), so it gets its own spec capability `queue`. The classification spec's requirements (pipeline, reasons, the per-payment "Payment card shows classification actions") are untouched — the queue is an _additional_ surface over the same actions. This keeps the classification contract stable and isolates the polish behavior.

_Alternative considered:_ fold queue requirements into `classification/spec.md`. Rejected — it would bloat the pipeline spec with UI-layout requirements and blur the "one capability = one route group" convention.

### D2. RSC for data + grouping, client components only for inline forms

`page.tsx` is a Server Component: it reads the `tab` search param (default `awaiting_review`), queries payments filtered by status, joins the candidate clients needed for `no_match`/`multiple_clients_same_edrpou`, computes per-reason groups via `lib/queue/group.ts`, and computes `client_incomplete` missing-field lists via `lib/queue/missing-fields.ts`. Each reason card that needs interactivity (`linkPaymentClientAction`, radio-select, classify/skip) is a `'use client'` leaf that calls the existing actions and `router.refresh()`. This mirrors the existing `classification-panel.tsx` pattern (client leaf → server action → refresh).

_Alternative considered:_ one giant client component fetching via API route. Rejected — RSC query is simpler, avoids a new endpoint, and matches the codebase.

### D3. Grouping and reason ordering live in `lib/queue/`, pure

`groupByReason(payments)` parses `classification_reason` with the same `key:detail` split already used in `classification-panel.tsx` (factored out so both surfaces agree), and orders groups by a fixed priority so the most actionable reasons surface first (e.g. `no_match`, `multiple_clients_same_edrpou`, `client_incomplete` before informational `external_edo`). Pure function → unit-testable, no Next.js import. The legacy `ambiguous_client` is grouped under the same card as `multiple_clients_same_edrpou`'s guidance but rendered read-only (historical only).

### D4. `client_incomplete` missing-field computation is UI-on-the-fly

`computeMissingFields(client, contract, serviceType)` returns the ordered list of missing required fields (`email`, `address`, `bank_name`, `bank_account`, contract, and — for `access` without `access_price_override` — `apartments_count`), each with a deep-link target (`/clients/[id]?focus=<field>` for client fields, the contract tab for the contract). This mirrors the completeness check in the classifier but is recomputed for display; it is **not** persisted. Keeping it pure and separate guarantees the queue's "missing list" stays consistent with the classifier's `client_incomplete` rule, and lets a unit test pin them together.

### D5. Reuse actions as-is; no new server actions for MVP

`no_match` link, `multiple_clients_same_edrpou` select → `linkPaymentClientAction`. `multiple_contracts` radio → set the chosen number is informational; resolution is "link the right client" (when EDRPOU ambiguous) or re-run via `classifyPaymentAction` after the operator fixes data; the radio is a guidance affordance, not a new persistence path. `amount_mismatch`/`sms_quantity_mismatch`/`external_edo`/`auto_act_disabled` → `classifyPaymentAction` (re-run after the admin fixes tariff/client/SMS data elsewhere) or `skipPaymentAction`. "Створити нового клієнта" links to `/clients/new` prefilled from the payer, then the operator returns and links. If implementation reveals a genuwinely missing shortcut, a thin new action may be added — but the design assumes none.

### D6. Pending-count nav indicator

The shared top-bar gains "Черга" with a count of `awaiting_review + in_queue` payments. Count is read in the layout/top-bar RSC (cheap `count(*)`), consistent with how other nav entries are static links today.

## Risks / Trade-offs

- **Reason copy drift between `/queue` and the payment card** → Mitigation: factor the `REASON_GUIDANCE` map and `parseReason` out of `classification-panel.tsx` into `lib/queue/` (or a shared module) and import from both, so there is one source of truth.
- **Missing-field list diverging from the classifier's completeness rule** → Mitigation: `computeMissingFields` is pure with a unit test asserting it flags exactly the fields the classifier checks (D-017 completeness check); when the classifier rule changes, the shared test fails.
- **`multiple_contracts` radio implies a persistence path that doesn't exist** → Mitigation: spec the radio as a _guidance/disambiguation aid_ that leads to a client-link or re-run, not a new "store chosen contract" action; avoids scope creep into the pipeline.
- **Pending count adds a query to every page render via top-bar** → Mitigation: single indexed `count(*)` on `payments.status`; acceptable for single-admin scale.
- **Legacy `ambiguous_client` rows** → Mitigation: render under a read-only historical card; no live resolution path required (D-041 deprecated it).

## Migration Plan

Pure additive UI slice. Deploy = ship the route + nav link. No DB migration, so dev/prod Neon branch divergence is irrelevant here. Rollback = revert the PR (the `/payments?status=in_queue` fallback and per-payment panel are untouched and keep working).

## Open Questions

- None blocking. The only judgment call deferred to implementation is whether `multiple_contracts` warrants a thin shortcut action (D5) — default is "no new action".

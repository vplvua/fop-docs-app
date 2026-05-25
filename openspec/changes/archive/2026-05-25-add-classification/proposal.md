## Why

Payments enter the system via PrivatBank polling (S6) with `status = received`, but nothing processes them further. The classifier is the central business logic that turns raw bank transactions into actionable data: matching payments to clients/contracts, determining service type, resolving price, computing quantity, and ultimately enabling act generation (S8). Without it, every payment requires full manual processing — the exact bottleneck the system is designed to eliminate.

## What Changes

- **New classifier engine** (`lib/classification/`) — 8-step pipeline running in a Postgres transaction with `SELECT ... FOR UPDATE` on `Payment`:
  1. Parse contract numbers from `purpose` using `Settings.contract_regex_patterns`
  2. Dedup + detect `multiple_contracts`
  3. Match client by contract number + `legal_id` two-factor check (with transit EDRPOU bypass)
  4. Check `client.auto_act_disabled` flag
  5. Check `client.edo_provider` for `vchasno_external`
  6. Detect `service_type` (`access` / `sms`) via `Settings.sms_keywords`
  7. Verify client data completeness for act generation
  8. Resolve price (via S4 tariff resolver) and compute quantity with amount validation
- **Automatic trigger** — classifier runs on every newly ingested payment (`status = received`) after PrivatBank polling
- **Manual reclassify** — server action to re-run classification on `awaiting_review` / `in_queue` payments after admin resolves the issue
- **Skip action** — mark payment as `skipped` (terminal state, no act)
- **Act stub creation** — on successful classification, create a minimal `acts` row (`status = draft`, no PDF yet — S8 responsibility) and link via `payments.act_id`
- **UI enhancements to payment card** — action panel on `/payments/[id]` for manual classification, skip, and showing classification reason details
- **DB migration** — `acts` table (stub schema: id, client_id, payment_id, status, snapshot fields, number, act_date — enough for classification to write; PDF/EDO fields added by S8/S9), plus `service_type_enum`

## Capabilities

### New Capabilities

- `classification`: Payment classification pipeline — automatic and manual classification of bank payments to clients/contracts, 8 classification reasons with queue routing, act stub generation on success. Covers FR-CLASS-01..18, FR-EDGE-03.

### Modified Capabilities

- `payments-ingest`: Payment card gains classification action panel (manual classify/skip buttons, reason display). Status transitions beyond `received` are now exercised.

## Impact

- **Code:** new `lib/classification/` module; new `lib/db/schema/acts.ts` (stub); new server actions in `app/(dashboard)/payments/[id]/`; modifications to payment card page
- **DB:** new migration for `acts` table, `service_type` enum; index on `(client_id, act_date, number)` UNIQUE
- **Dependencies:** consumes `lib/settings/` (regex patterns, sms keywords, transit EDRPOU), `lib/tariffs/resolve.ts`, `lib/db/schema/clients.ts`, `lib/db/schema/contracts.ts`, `lib/db/schema/payments.ts`
- **Testing:** largest test surface in MVP — every classification reason branch needs coverage (no_match, multiple_contracts, ambiguous_client, client_incomplete, auto_act_disabled, external_edo, amount_mismatch, sms_quantity_mismatch)

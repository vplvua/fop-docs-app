## Why

All payments in this system are prepayments, so every act is backed by a payment — there is no act without one. But some real payments never reach the app: money received in a different bank (no integration — PrivatBank only), or payments that predate the app's launch for which the admin still wants an act stored, rendered to PDF, and sent to DubiDoc. Today the only way to produce an act is the automatic classification of a PrivatBank transaction. The admin needs a way to create an act manually for these cases, backed by a manually-recorded payment, with full control over client, period, service, quantity and amount.

This builds on the `payments.source` / `bank_label` columns introduced by `add-privatbank-statement-by-date`.

## What Changes

- New admin page **«Створити акт вручну»**: pick a client (only clients that have a contract), pick the act period month, pick a service, set quantity and amount (the configured tariff pre-fills the price/quantity as a hint, fully overridable), then create the act and send it to DubiDoc.
- Under the hood each manual act creates a backing **manual payment** (`source = 'manual_external'`, synthetic `bank_transaction_id = 'manual:{uuid}'`, optional `bank_label` for the originating bank), so the "act always has a payment" invariant holds and history stays unified.
- New **manual act creation path** (`createManualAct`) that assembles the act stub directly from admin inputs (bypassing automatic classification's payment-derived service/quantity/amount), reusing the existing race-safe numbering, FOP-requisites snapshot, PDF generation, and DubiDoc send.
- The backing payment is recorded as `classified` and linked to the created act (`act_id`), exactly as classification would leave it — so it appears in payment history like any other.
- **Act period is decoupled from payment date**: the admin chooses the period month directly (`act_date` = last day of the chosen month), independent of when the money arrived.

## Capabilities

### New Capabilities

- `manual-acts`: admin-driven creation of an act (and its backing manual payment) for payments that did not arrive via PrivatBank — covering client/period/service/quantity/amount entry, tariff-hinted pricing, the act-always-has-a-payment invariant, and reuse of the existing numbering/PDF/EDO pipeline.

### Modified Capabilities

- `payments-ingest`: records that a payment may originate from manual entry (`source = 'manual_external'`) with a synthetic `bank_transaction_id` and optional `bank_label`, and is excluded from the PrivatBank unique-id space by construction.

## Impact

- **Depends on:** `add-privatbank-statement-by-date` (introduces `payments.source` / `bank_label`). No new migration for those columns here.
- **Code (new):** admin route + page «Створити акт вручну»; server action `createManualActAction`; `lib/acts/create-manual-act.ts` (`createManualAct` orchestrator); Zod schema for the manual-act form; a client-with-contract loader for the picker; a synthetic `bank_transaction_id` generator.
- **Code (reused):** `buildActStub` / `nextActNumber` / `getFopRequisites` / `getServiceNames` / `generateAndStoreActPdf` / `sendToDubidoc`; `resolveAccessPrice` / `resolveSmsPrice` for the tariff hint.
- **DB:** no schema change beyond what `add-privatbank-statement-by-date` already added; the manual payment row is a normal `payments` insert with `source = 'manual_external'`.
- **No external API calls** for payment creation (the money came from elsewhere); DubiDoc send reuses the existing integration.

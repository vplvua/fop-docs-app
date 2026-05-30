## Why

Payments today enter the system only through the hourly cron poll of the PrivatBank Автоклієнт `/interim` endpoint. If a poll is missed (downtime, token lapse, a transaction the bank finalised outside the overlapping window) or a payment predates the app's launch, the admin has **no way to bring that payment in** — and with no payment there can be no act. The bank already exposes a dated statement endpoint (`/api/statements/transactions?startDate=...`, confirmed in `docs/api-docs/Privatbank_API.pdf`), so the admin should be able to pull a real transaction for a known date and import it as a first-class payment that flows through the existing classification → act pipeline.

This also lays the shared `payments.source` foundation that the follow-up `add-manual-act` change depends on.

## What Changes

- New admin page **«Завантажити платіж за датою»**: admin enters a date (or short range), the app queries PrivatBank for that period, lists the real confirmed transactions, and imports the selected one as a `payments` row (`source = 'privatbank'`) that then runs through existing classification exactly like a polled payment.
- Extend the PrivatBank client with a dated-statement fetch (`fetchTransactionsByDate`) reusing the existing paging, retry/backoff, confirmed-transaction filter, and `mapTransaction` machinery.
- **Dedup control (two layers)** so the same transaction can never be double-imported across the poll path and the by-date path:
  - read-time: each fetched transaction is annotated as _new_ (importable) or _already in system_ (disabled, linked to the existing payment / its act) before the admin sees the list;
  - write-time: insert via `ON CONFLICT (bank_transaction_id) DO NOTHING` — a conflict routes the admin to the existing payment instead of creating a duplicate.
- New shared column **`payments.source`** (`'privatbank' | 'manual_external'`, default `'privatbank'`, existing rows backfilled) plus optional **`payments.bank_label`** (always `null` here; reserved for the other-bank case in `add-manual-act`).
- No new cron job. Reuses `classifyInserted`, `mapTransaction`, and `integration_health` recording.

## Capabilities

### New Capabilities

<!-- none -->

### Modified Capabilities

- `payments-ingest`: adds an on-demand "import payment by date from PrivatBank statement" requirement, a dedup-annotation requirement for the by-date path, and a `source`/`bank_label` provenance requirement on the payments model.

## Impact

- **Code (new):** admin route group + page for by-date import; server actions (fetch-and-annotate, import-selected); a pure dedup-annotation helper; MSW handler for the dated endpoint.
- **Code (modified):** `lib/external-apis/privatbank/client.ts` (+`fetchTransactionsByDate`), `lib/external-apis/privatbank/index.ts` (export), `lib/db/schema/payments.ts` (+`source` enum column, +`bank_label`), `tests/mocks/handlers/privatbank.ts`.
- **DB:** one migration adding `payment_source` pgEnum + `source` (NOT NULL default `'privatbank'`, backfill) + nullable `bank_label`. Per `docs/operations.md`, dev and prod are separate Neon branches — prod migrated separately.
- **External API:** GET `https://acp.privatbank.ua/api/statements/transactions` (same `token` header, same response shape as `/interim`). No new env vars (reuses `PRIVATBANK_TOKEN`, `FOP_BANK_ACCOUNT`).
- **Downstream dependency:** `add-manual-act` builds on the `source`/`bank_label` columns introduced here.

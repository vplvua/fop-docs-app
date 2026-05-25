## Context

S6 (payments-ingest) delivers payments with `status = received` into the `payments` table. The classification engine (S7) is the core business logic that transforms raw bank transactions into structured data ready for act generation (S8).

Current state:

- `payments` table exists with all classification-related columns pre-provisioned (S6): `status`, `classification_reason`, `parsed_contract_numbers`, `client_id`, `service_type`, `unit_price`, `quantity`, `quantity_unit`, `act_id`
- `clients`, `contracts`, `tariffs`, `sms_prices`, `settings` tables are populated
- `lib/tariffs/resolve.ts` provides `resolveAccessPrice(client, tariffs, paymentDate)` and `resolveSmsPrice(prices, paymentDate)`
- `lib/settings/` provides `getContractPatterns()`, `getSmsKeywords()`, `getTransitEdrpouList()`

The `acts` table does not yet exist — this slice creates a stub schema sufficient for the classifier to write a minimal act row. Full act lifecycle (PDF, numbering under FOR UPDATE, snapshots) is S8's responsibility.

## Goals / Non-Goals

**Goals:**

- Implement the full 8-step classification pipeline (FR-CLASS-01..18)
- Route unclassifiable payments to the correct queue reason
- Create minimal act stubs on successful classification
- Provide manual classify/skip actions on the payment card UI
- Auto-trigger classification on ingest; support manual re-run after admin intervention

**Non-Goals:**

- PDF generation, act numbering under FOR UPDATE, snapshot immutability — S8
- Queue polish UI with grouped reasons and inline forms — S12
- EDO integration (Dubidoc send, Vchasno flow) — S9/S10
- Dashboard counters and health banners — S13
- Bulk classify operations — Phase 1

## Decisions

### D1: Classification as a pure function with DB transaction wrapper

The classifier is split into two layers:

- **Pure pipeline** (`lib/classification/classify.ts`) — accepts all needed data as arguments (payment, client, contract, patterns, keywords, transit list, tariffs, sms prices) and returns a `ClassificationResult` discriminated union. No DB access, fully testable.
- **Orchestrator** (`lib/classification/run-classification.ts`) — fetches data, acquires `SELECT ... FOR UPDATE` on the payment row, calls the pure pipeline, writes results back. Runs inside a Postgres transaction.

_Alternative considered:_ single function that queries as-needed inside the pipeline. Rejected — harder to test, interleaves DB with logic, makes it difficult to test all 8 reason branches without a live DB.

### D2: Act stub schema — minimal for S7, extended by S8

S7 creates the `acts` table with fields needed by the classifier:

- `id`, `client_id` (FK RESTRICT), `payment_id` (FK RESTRICT), `status` (enum: draft, sent_to_edo, signed, deleted), `service_type`, `unit_price`, `quantity`, `quantity_unit`, `act_date`, `number` (text), `client_snapshot` (jsonb), `contract_snapshot` (jsonb), `service_description`, `edo_provider`, `created_at`, `updated_at`
- UNIQUE index `(client_id, act_date, number)` — enforced from day one
- S8 adds: `pdf_file_url`, `edo_doc_id`, `edo_status`, `sent_to_edo_at`, and the act numbering logic with FOR UPDATE

The act stub row created by S7 has `status = draft`, `number` generated with a simple query (not race-safe — S8 upgrades to FOR UPDATE), and snapshot fields populated at classification time.

_Alternative considered:_ defer acts table entirely to S8, store classification result only in payment columns. Rejected — the `payment.act_id` FK needs a target table; creating the stub now matches the PRD flow where classification produces an act atomically (FR-CLASS-16).

### D3: Act number generation (S7 stub)

S7 generates act numbers with a simple `COUNT + 1` query on `(client_id, year, month)`. This is NOT race-safe under concurrent writes — acceptable because:

1. S7 has no concurrent act generation (manual classify is sequential admin action)
2. The UNIQUE index `(client_id, act_date, number)` catches collisions at DB level
3. S8 upgrades to proper `SELECT ... FOR UPDATE` with retry

### D4: Classification trigger after ingest

The PrivatBank polling handler (`app/api/cron/privatbank-poll/route.ts`) will call `classifyPayment(paymentId)` for each newly inserted payment after the polling loop. This keeps classification synchronous with ingest in the happy path (NFR-PERF-05: < 60s end-to-end).

_Alternative considered:_ queue-based decoupling (classify via a separate cron). Rejected — adds latency and complexity for ~500 payments/month scale. If a single classification fails, it gracefully falls into `in_queue` without blocking the rest.

### D5: Service type detection — keyword match on purpose

`service_type` determination (FR-CLASS-11): if `purpose.toLowerCase()` contains any keyword from `Settings.sms_keywords` → `sms`; otherwise → `access`. The value `other` is only assigned manually via the queue UI (S12).

Keyword matching is case-insensitive substring search, not regex — simple and predictable per PRD.

### D6: Client completeness check

Before resolving price, the classifier checks required fields for act generation (FR-CLASS-12):

- Always required: `email`, `address`, `bank_name`, `bank_account`
- Contract must exist
- For `service_type = access` without `access_price_override`: `apartments_count` must be set

Missing fields are stored as a JSON array in `classification_reason` (e.g. `client_incomplete:email,bank_name`). The format uses a `reason:detail` pattern for all reasons that carry extra context (e.g. `multiple_contracts:556770,556771`).

### D7: Quantity parsing for SMS

For `service_type = sms` (FR-CLASS-14): quantity is parsed from `purpose` using a regex that looks for patterns like "у кількості 100", "100 шт", "кількість: 100". If no quantity is parseable, or if `parsed_quantity × sms_unit_price ≠ amount`, the payment goes to `in_queue(sms_quantity_mismatch)`.

`quantity_unit` for SMS is always `"шт."`.

### D8: UI approach — action panel on existing payment card

No new pages. The existing `/payments/[id]` card gains a conditional action panel:

- For `received` / `awaiting_review` / `in_queue`: "Класифікувати" (re-run) and "Пропустити" buttons
- For `in_queue`: shows reason details and guidance text
- For `classified`: read-only summary linking to the created act stub
- For `skipped`: read-only "Пропущено" badge

This keeps S7 UI minimal; the full queue experience with inline forms is S12.

## Risks / Trade-offs

- **[Risk] Act number generation is not race-safe** → Mitigated by UNIQUE index + S8 upgrades to FOR UPDATE. Acceptable for S7 where classification is not concurrent.
- **[Risk] Large test surface (8 reason branches × happy/edge)** → Mitigated by pure function design (D1) enabling fast unit tests without DB. Estimated 30+ test cases.
- **[Risk] SMS quantity regex may not cover all purpose text formats** → Mitigated by falling back to `sms_quantity_mismatch` queue for admin review. Regex patterns can be refined iteratively.
- **[Trade-off] Classification is synchronous with ingest** → Simplest approach at current scale. If polling returns many payments at once, classification runs sequentially for each. At 500/month this is negligible.
- **[Trade-off] Act stub is thin** → S8 must add columns and upgrade numbering logic. But this avoids S7 taking on PDF/EDO concerns.

## Why

After S8 (acts), acts are created with `status = draft` and a PDF in Blob, but never leave the system. The admin must manually upload each act to DubiDoc — defeating the core automation goal (PRD § 1: "час від платежу до акту в Дубідок < 1 година"). S9 closes the loop: classified acts for `edo_provider = dubidoc` clients are automatically sent to DubiDoc via API, and a polling cron keeps `Act.status` / `Act.edo_status` in sync with DubiDoc's document lifecycle.

## What Changes

- **DubiDoc HTTP client** (`lib/external-apis/dubidoc/`): `createDocument` (POST with base64 PDF, inline participants, Premium fields) and `getDocumentStatus` (GET polling). Retry/backoff pattern reused from PrivatBank client. Error types for 401/5xx/timeout.
- **Send-to-EDO orchestrator** (`lib/edo/dubidoc.ts`): called automatically after act creation (from classification pipeline) and manually via server action. Assembles request payload from act snapshots, uploads PDF from Blob, sets `Act.status = sent_to_edo` + `Act.edo_doc_id` on success.
- **Polling cron** (`app/api/cron/dubidoc-poll/route.ts`): registered in `vercel.ts` at `0 */6 * * *`. Fetches all acts with `status = sent_to_edo AND edo_provider = dubidoc`, polls DubiDoc for each, maps response → act status (signed / deleted / refused / intermediate).
- **Act card UI enhancements**: "Перейти в Дубідок" link, "Оновити статус" button, "Спробувати ще раз" for failed sends, "Не відправлено" indicator for draft acts that failed EDO send, "Клієнт відмовився" banner for `edo_status = refused`.
- **Dashboard integration**: manual "Опитати статуси Дубідок" button triggers polling out of schedule.
- **Observability**: both endpoints update `integration_health(service = 'dubidoc')`.
- **MSW mock handler** for DubiDoc API (`tests/mocks/handlers/dubidoc.ts`).

## Capabilities

### New Capabilities

- `edo-dubidoc`: DubiDoc EDO integration — automatic act sending via POST /documents, polling-based status sync, retry with idempotency, UI controls for manual send/retry/status-refresh.

### Modified Capabilities

_(none — acts schema already has all EDO fields from S7/S8; classification pipeline already checks `edo_provider` and routes `dubidoc` clients to auto-act generation)_

## Impact

- **New files**: `lib/external-apis/dubidoc/client.ts`, `lib/external-apis/dubidoc/types.ts`, `lib/external-apis/dubidoc/mapper.ts`, `lib/edo/dubidoc.ts`, `app/api/cron/dubidoc-poll/route.ts`, `tests/mocks/handlers/dubidoc.ts`.
- **Modified files**: `vercel.ts` (add cron), `app/(acts)/acts/[id]/page.tsx` (EDO buttons/status), `app/(dashboard)/page.tsx` or dashboard actions (poll-now button), classification pipeline hook (auto-send after act creation).
- **Dependencies**: no new npm packages (uses native `fetch`).
- **Env**: `DUBIDOC_TOKEN` (already in `.env.example` / NFR-SEC-02, not yet wired).
- **DB migrations**: none — `acts` table already has `edo_doc_id`, `edo_status`, `sent_to_edo_at` from S7/S8 migration.
- **PRD coverage**: FR-EDO-01..12, FR-EDGE-01, TC-INTEG-02, TC-INTEG-13, NFR-PERF-04..06.
- **TBD-S9-1**: sandbox token for DubiDoc Premium must be obtained before E2E testing.

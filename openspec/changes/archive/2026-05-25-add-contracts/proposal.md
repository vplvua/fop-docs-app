## Why

Clients exist (S2), but cannot have contracts attached — and without a contract, the classifier (S6/S7) cannot generate acts. Contracts are the next dependency in the MVP graph (S3 → S6) and unblock the entire payment-to-act pipeline. The client card already shows "Без договору акти не генеруються" on every tab; this slice makes that warning conditional.

## What Changes

- New `contracts` table in Postgres with FK `client_id REFERENCES clients(id) ON DELETE RESTRICT`, enforcing 0..1 cardinality per client via UNIQUE constraint on `client_id`.
- Fields: `number` (text, default = client's `moeosbb_user_id` if present), `signed_date` (date), `is_standard` (boolean, default true), `file_url` (nullable text for Blob link), `notes` (nullable text).
- Server actions: `createContract`, `updateContract`, `deleteContract`.
- Delete is blocked at DB level (FK RESTRICT from future `acts` table) — for now, delete is allowed since no acts reference contracts yet; the RESTRICT constraint will be added by S8.
- Client card `"Договір"` tab replaces the S2 stub with an embedded contract form (create if none exists, edit if one does).
- `ContractWarning` component becomes conditional — shown only when client has no contract.
- Optional: if `file_url` is populated, show a PDF preview iframe or download button (FR-CTR-06).
- Zod validation for `signed_date` (required date), `number` (non-empty string).

## Capabilities

### New Capabilities

- `contracts`: Admin CRUD for contracts (0..1 per client). Covers FR-CTR-01 through FR-CTR-06.

### Modified Capabilities

- `clients`: The contract warning (FR-CLI-11) becomes conditional on actual contract existence instead of always-on. The "Договір" tab renders real content instead of a stub.

## Impact

- **DB:** new migration `0003_add_contracts.sql` with `contracts` table + unique index on `client_id`.
- **Schema:** new `lib/db/schema/contracts.ts` exporting Drizzle table + types.
- **Validation:** new `lib/validation/contracts.ts` with Zod schemas.
- **Server actions:** new `app/(dashboard)/clients/[id]/contract-actions.ts` (or similar).
- **UI:** modified `client-card.tsx` (contract tab content, conditional warning), new contract form component.
- **Tests:** new unit tests for validation schemas, contract cardinality enforcement.
- **No new dependencies** — uses existing Drizzle, Zod, shadcn/ui stack.

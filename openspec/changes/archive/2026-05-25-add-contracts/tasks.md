## 1. Database Schema & Migration

- [x] 1.1 Create `lib/db/schema/contracts.ts` — Drizzle table `contracts` with fields: `id` (uuid PK), `client_id` (uuid FK → clients, UNIQUE, NOT NULL, ON DELETE RESTRICT), `number` (text NOT NULL), `signed_date` (date NOT NULL), `is_standard` (boolean NOT NULL default true), `file_url` (text nullable), `notes` (text nullable), `created_at`, `updated_at`. Export `Contract` and `NewContract` types.
- [x] 1.2 Register `contracts` in `lib/db/schema/index.ts` barrel export.
- [x] 1.3 Run `drizzle-kit generate` to produce migration `0003_add_contracts.sql`. Verify the SQL contains UNIQUE on `client_id` and FK RESTRICT.
- [x] 1.4 Apply migration to Neon dev branch via `drizzle-kit migrate`.

## 2. Validation Schemas

- [x] 2.1 Create `lib/validation/contracts.ts` with `createContractSchema` (requires `clientId` uuid, `number` non-empty string, `signed_date` date string; optional `isStandard` boolean, `fileUrl` URL-or-empty string, `notes` string) and `updateContractSchema` (requires `id` uuid; all other fields optional). Follow same patterns as `lib/validation/clients.ts`.

## 3. Server Actions

- [x] 3.1 Create `app/(dashboard)/clients/[id]/contract-actions.ts` with `"use server"` directive. Implement `createContract`, `updateContract`, `deleteContract` server actions following the same pattern as client actions (Zod parse → DB check cardinality → insert/update/delete → revalidatePath → return action state).
- [x] 3.2 In `createContract`: check no existing contract for `clientId` before insert; pre-validate cardinality at application level with friendly error. Log `contract.created` event.
- [x] 3.3 In `updateContract`: verify contract exists, parse fields, update with `updatedAt = now()`. Log `contract.updated` event.
- [x] 3.4 In `deleteContract`: verify contract exists, attempt delete (will succeed in S3; will fail with FK error after S8 adds acts FK). Catch FK violation and return friendly error "Неможливо видалити договір з прив'язаними актами". Log `contract.deleted` event.

## 4. UI — Contract Form Component

- [x] 4.1 Create `app/(dashboard)/clients/[id]/contract-form.tsx` — a `"use client"` component that renders create form (when `contract` prop is null) or edit form (when `contract` prop is provided). Fields: number (text input), signed_date (date input), is_standard (checkbox), file_url (text input), notes (textarea). Use `useActionState` with contract server actions. Pre-fill `number` from `client.moeosbbUserId` when creating.
- [x] 4.2 Add "Видалити договір" button to the edit form variant, with confirmation. Wire to `deleteContract` action.
- [x] 4.3 Add file download link when `file_url` is populated — "Завантажити документ" opening in new tab.
- [x] 4.4 Add warning text when editing number/signed_date on a contract: "Зміна номеру/дати не переоформлює вже згенеровані акти" (FR-CTR-04). Visible only in edit mode.

## 5. UI — Client Card Integration

- [x] 5.1 Update `/clients/[id]/page.tsx` server component to fetch the client's contract (if any) from DB alongside the client data. Pass `contract` prop to `ClientCard`.
- [x] 5.2 Update `ClientCard` component: accept optional `contract` prop and `client` prop. Pass them to `TabContent`.
- [x] 5.3 Replace `StubTab` for the "contract" tab case with `ContractForm` component, passing `contract` (or null) and `client`.
- [x] 5.4 Make `ContractWarning` conditional: render only when `contract` is null/undefined.

## 6. Tests

- [x] 6.1 Create `tests/unit/validation/contracts.test.ts` — test `createContractSchema` and `updateContractSchema`: valid inputs, empty number rejected, missing signed_date rejected, optional fields accepted as undefined.
- [x] 6.2 Add cardinality-related unit test: verify that the schema's `clientId` field requires a valid UUID.

## 7. Quality & Finalization

- [x] 7.1 Run `npm run qa` (lint, format:check, typecheck, test:run, build, openspec validate) — all 6 gates green.
- [x] 7.2 Manual smoke test: create a contract on the "Договір" tab, edit it, delete it. Verify warning appears/disappears. Verify pre-fill from `moeosbb_user_id`.

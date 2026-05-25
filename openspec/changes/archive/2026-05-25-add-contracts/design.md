## Context

S2 (clients) is complete. Every client card shows "Без договору акти не генеруються" unconditionally because the `contracts` table does not exist. S3 adds contracts as a prerequisite for the payment-to-act pipeline (S6/S7/S8). The contract entity is simple: 0..1 per client, five user-editable fields, no external API calls.

Current stack: Drizzle ORM over Neon HTTP driver (no `db.transaction()`), Zod validation, server actions with `useActionState`, shadcn/ui components, DESIGN.md tokens.

## Goals / Non-Goals

**Goals:**

- `contracts` table with FK to `clients`, UNIQUE on `client_id` enforcing 0..1 cardinality.
- Full CRUD via server actions following the existing pattern in `app/(dashboard)/clients/actions.ts`.
- Contract form embedded in the client card "Договір" tab (not a separate page).
- Conditional contract warning — only shown when client has no contract.
- Zod validation schemas in `lib/validation/contracts.ts`.
- Unit tests for validation schemas and cardinality logic.

**Non-Goals:**

- Standalone `/contracts` route (PRD mentions it but the primary UX is the client card tab; a standalone list can be added later if needed).
- PDF preview iframe for `file_url` — deferred; we show a download link if `file_url` is set (FR-CTR-06 minimal).
- FK RESTRICT from `acts` → `contracts` — that FK arrives with S8 when the `acts` table is created. For now, delete is allowed.
- File upload to Vercel Blob for contract documents — `file_url` is a manual text field (URL). Blob upload comes with S8 if needed.

## Decisions

### D-S3-01: Embed contract form in client card tab

**Choice:** Contract create/edit form lives inside the "Договір" tab of `/clients/[id]`, not on a separate `/contracts/...` route.

**Why:** The PRD says "форма embedded у картці клієнта" (§5 S3). A contract without its client context is meaningless. The client card already has a tab for it. A standalone `/contracts` list page adds navigation complexity for a 1:0..1 relationship.

**Alternative considered:** Separate `/contracts` page — rejected because it duplicates navigation for a dependent entity.

### D-S3-02: UNIQUE constraint on `client_id` for 0..1 cardinality

**Choice:** `UNIQUE(client_id)` on the `contracts` table. Application layer also checks before insert.

**Why:** DB-level guarantee is the strongest protection. The application-level check gives a friendly error message before hitting the constraint.

### D-S3-03: Contract number defaults to `moeosbb_user_id`

**Choice:** When creating a contract, if the client has `moeosbb_user_id`, pre-fill `number` with its string value. Admin can override.

**Why:** FR-CTR-03 says `number` defaults to `moeosbb_user_id`. This is a UI pre-fill, not a DB default — the admin must explicitly submit.

### D-S3-04: Server actions pattern matches S2

**Choice:** Same pattern as clients: `"use server"` actions in a co-located file, `useActionState` on the client component, Zod validation, `revalidatePath` after mutation.

**Why:** Consistency with established codebase conventions. No new patterns introduced.

### D-S3-05: Delete allowed in S3 (no acts yet)

**Choice:** `deleteContract` action exists and works in S3. When S8 adds `acts.contract_id REFERENCES contracts(id) ON DELETE RESTRICT`, deletion will be blocked at DB level for contracts with acts.

**Why:** There are no acts yet. Adding a premature restriction would be designing for a hypothetical. The RESTRICT constraint arrives naturally with S8.

### D-S3-06: Contract data fetched server-side alongside client

**Choice:** The client card page (`/clients/[id]/page.tsx`) fetches the contract (if any) in the same server component and passes it as a prop to `ClientCard`.

**Why:** Avoids a client-side fetch waterfall. One query is sufficient given the 1:0..1 relationship. Uses a LEFT JOIN or separate query — both are fine for this scale.

## Risks / Trade-offs

- **[Neon HTTP driver — no transactions]** → For S3, all contract operations are single-statement (INSERT/UPDATE/DELETE). No transaction needed. The UNIQUE constraint prevents double-insert races at DB level.
- **[No file upload]** → `file_url` is a plain text input. If the admin needs to upload a file, they must use Vercel Blob dashboard or wait for S8. Acceptable for MVP — most contracts are referenced by external URL or not stored digitally.
- **[Delete allowed before RESTRICT]** → An admin could delete a contract that "should" be protected. Acceptable because acts don't exist yet, and the admin is a single trusted user.

# Edit and delete manual acts

## Why

The manual-act flow (`add-manual-act`) lets an admin create an act for money that
did not arrive through the automatic PrivatBank classification. But once created,
a manual act is effectively frozen: the only editable field is the service
description (`updateServiceDescriptionAction`), and there is no way to delete an
act at all. If the admin mistypes the amount, quantity, price, service, bank or
payment date — or picks the wrong row entirely — the act is stuck. The only
"delete" path today is the DubiDoc poller flipping `status = 'deleted'` when the
document is archived on DubiDoc's side; there is no operator-driven delete.

This change lets the admin **fix** a manual act's value fields and **remove** a
mistaken manual act so a correct one can be created in its place.

## What Changes

Both new actions are scoped to **manual acts only** (the backing payment has
`source = 'manual_external'`) and only while the act has **not left the building** —
i.e. `status = 'draft'` OR `edo_provider = 'vchasno_external'`. Acts already sent
to DubiDoc (`sent_to_edo`) and signed DubiDoc acts are out of scope for now,
because DubiDoc exposes no cancel/delete API (`lib/external-apis/dubidoc/client.ts`
has only `createDocument` / `getDocumentStatus`), so editing or deleting a sent
act would orphan the external document. This is the same eligibility predicate
that already gates description editing.

- **Edit (value fields only).** A new `updateManualActAction` lets the admin
  change `service_type`, `quantity`, `unit_price`, `amount`, `bank_label` and
  `payment_date` (plus the existing service description). The **client and period
  stay read-only** — they define the act number and the snapshots, and changing
  them would force a renumber and a snapshot rebuild (delete + recreate
  territory). The edit updates the act and its backing payment together in one
  transaction (so the act sum and the payment stay in sync), then regenerates the
  PDF (which re-sends to DubiDoc for the still-`draft` dubidoc case via the
  existing path).
- **Delete (hard).** A new `deleteManualActAction` removes the act row and its
  synthetic backing payment in one transaction. The act number `MM/YYYY[/N]` is
  freed for reuse, so the admin can immediately create a correct act. (Hard delete
  is chosen over soft delete to avoid colliding with the `UNIQUE(client, act_date,
number)` constraint and with the existing `status = 'deleted'` meaning of
  "archived in DubiDoc".)
- **UI.** The act detail panel gains "Редагувати акт" (opens the manual-act form
  prefilled, with client and period shown read-only) and "Видалити акт" (with a
  confirmation), rendered only when the act is an editable manual act.

No DB migration — eligibility is derived from the existing `payments.source`
column; no new columns or enum values.

## Impact

- Affected specs: `manual-acts` (2 ADDED requirements: edit, delete).
- Affected code:
  - `lib/acts/` — new `updateManualAct` / `deleteManualAct` orchestrators
    (transactional, mirroring `create-manual-act.ts`).
  - `lib/acts/manual-act-schema.ts` — an edit schema (value fields, no
    `clientId` / period).
  - `app/(dashboard)/acts/[id]/act-actions.ts` — `updateManualActAction`,
    `deleteManualActAction` (with the manual-only + status guard).
  - `app/(dashboard)/acts/[id]/page.tsx` — loader joins `payments.source` to
    decide whether the act is manual.
  - `app/(dashboard)/acts/[id]/act-detail-panel.tsx` — edit/delete affordances.
  - `app/(dashboard)/acts/new/manual-act-form.tsx` — reused in edit mode with
    read-only client/period.
- No migration, no cron, no external API changes.
- Out of scope: editing/deleting non-manual (auto) acts; editing/deleting
  `sent_to_edo` or signed DubiDoc acts; changing a manual act's client or period.

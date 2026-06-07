## Context

The trigger was unreadable DubiDoc titles (identical across clients). Two designs were
explored before this one:

1. **Extract the quoted name** from the full legal name (`ОСББ «X»` → `X`). Broke on
   nested quotes: `ТОВ "УПРАВЛЯЮЧА КОМПАНІЯ "ЛАД"` extracts `УПРАВЛЯЮЧА КОМПАНІЯ ` or
   `ЛАД` — both wrong.
2. **Strip a curated legal-form prefix.** More robust, but still a heuristic over an
   open-ended, inconsistently-spelled/abbreviated set of legal forms, and the residual
   quote handling stayed ambiguous.

Both are guesses over messy data. The chosen design removes the guessing: the operator
stores an authoritative short name. Client count is low, so the one-time data entry is
cheap and permanent.

## Goals / Non-Goals

- **Goal:** an authoritative, operator-curated short name that drives the DubiDoc title
  and the two most space-constrained list columns.
- **Goal:** safe fallback — empty short name never blanks anything; the full name shows.
- **Non-Goal:** automatic derivation of the short name (no stripping, no suggestion
  prefill — that reintroduces the fragile code we are removing).
- **Non-Goal:** changing the PDF `filename` (already carries the contract number).
- **Non-Goal:** retitling acts already sent to DubiDoc.

## Decisions

### Storage: nullable `clients.short_name`

A plain nullable `text` column. NULL/empty means "no short name yet" → fallback to
`name`. Empty-string input is normalized to NULL in the server action.

### Display helper

`displayClientName(client) = client.shortName?.trim() || client.name` — a pure function
in `lib/clients/display-name.ts`, reused by every UI surface in scope.

### Snapshot vs live — split by surface

| Surface              | Source                                                   | Why                                                                                                  |
| -------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| DubiDoc `title`      | frozen `clientSnapshot.shortName ?? clientSnapshot.name` | document is immutable; title must match the act as issued                                            |
| PDF                  | unchanged (no client short name in filename)             | filename already keys on contract number                                                             |
| Clients list "Назва" | live client                                              | always current                                                                                       |
| Acts list "Клієнт"   | **live** client (join)                                   | so existing acts show the short name once filled; list is a convenience view, not the legal artifact |

The acts list already joins `acts.client_id → clients` for search, so reading the live
client name for display adds no new join — it only changes the rendered field from
`act.clientSnapshot.name` to `displayClientName(joinedClient)`.

### Title format

`{displayName} {contractNumber} Акт {number} від {actDate}` — space-separated, contract
number bare (no "дог." label), `Акт … від …` kept verbatim, `actDate` left as raw ISO.
`displayName` = `clientSnapshot.shortName ?? clientSnapshot.name`; `contractNumber` from
`contractSnapshot.number` (as `pdf-filename.ts` already does).

Example: `МОЛОДІЖНИЙ НОВОМОСКОВСЬК 556848 Акт 02/2026 від 2026-02-28`.

Casing is preserved as stored — the operator controls it; the system never upper/lower-cases.

### Sync protection by omission

`mapRemoteToClientFields` (MoeOSBB) maps only name, legalId, address, bankName,
bankAccount, email. `short_name` is absent, so the sync UPDATE never sets it. No
explicit allow/deny list change is needed; a regression test asserts a synced client
keeps its operator-set short name.

## Risks / Trade-offs

- **Manual upkeep.** New clients arrive without a short name until the operator fills it.
  Mitigation: fallback to full name is always safe; the operator reviews new payments
  and fills the short name then (accepted workflow).
- **List vs document divergence.** The acts list (live) can show a short name the frozen
  DubiDoc title/PDF do not. Accepted: the list is a convenience view; the legal artifact
  stays frozen.

## Migration Plan

Single additive, nullable column — no backfill required. Apply to dev via
`npm run db:migrate`; apply to production separately per the `docs/operations.md` runbook
(separate Neon branches). Watch the `db:generate` journal gotcha noted in project memory.

## Open Questions

<!-- none -->

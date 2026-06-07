## Why

The DubiDoc document `title` is currently `Акт {number} від {act_date}` — identical
for every counterparty. In the DubiDoc UI the operator cannot tell acts apart without
opening each one; the only other visible signal is the client's email, which is not
memorable. Finding a specific act is slow.

The natural fix — putting the client name into the title — runs into the legal-name
problem: `name` is the full legal name (e.g. `Обʼєднання співвласників
багатоквартирного будинку «Молодіжний Новомосковськ»` or `ТОВАРИСТВО З ОБМЕЖЕНОЮ
ВІДПОВІДАЛЬНІСТЮ "УПРАВЛЯЮЧА КОМПАНІЯ "ЛАД"`), which is long and full of legal-form
boilerplate. Auto-stripping the legal form is fragile: nested quotes, abbreviated vs
full forms, and the open-ended set of legal forms all break heuristics.

Instead of guessing, the operator curates a **short name** per client. Clients are
few; the short name is entered once and reused. It feeds the DubiDoc title and also
shortens the most space-constrained list columns in the app.

## What Changes

- New nullable column `clients.short_name` — operator-curated short display name.
- Client create/edit form gets an optional "Коротка назва" field (trimmed; empty → NULL).
- New pure helper `displayClientName(client)` = `short_name || name` (fallback to full
  name when short name is empty).
- The act's frozen client snapshot gains `shortName` (captured at act creation).
- DubiDoc `title` becomes `{short or full name} {contract_number} Акт {number} від {act_date}`,
  sourced from the act's client + contract snapshots. The `filename` field is unchanged.
- UI: the Clients-list "Назва" column and the Acts-list "Клієнт" column display the
  short name (full name as hover tooltip). The Acts-list column reads the **live**
  client (join), so existing acts pick up the short name once it is filled; the
  DubiDoc title and PDF stay on the frozen snapshot.
- MoeOSBB sync leaves `short_name` untouched (it is absent from the sync field mapper,
  so the sync UPDATE never sets it — protected by omission).

## Capabilities

### New Capabilities

<!-- none -->

### Modified Capabilities

- `clients`: new `short_name` field on create/edit; list "Назва" column shows the short
  name; a `displayClientName` fallback rule; sync-protection of the field.
- `edo-dubidoc`: the document `title` now identifies the client and contract instead of
  being identical across counterparties.
- `acts`: the immutable client snapshot carries `shortName`; the acts-list "Клієнт"
  column shows the short name from the live client.

## Impact

- DB: migration adding nullable `clients.short_name` (dev + prod separate Neon branches
  — see `docs/operations.md`).
- Code: `lib/db/schema/clients.ts`, `lib/clients/display-name.ts` (new),
  `lib/classification/types.ts` + `lib/classification/act-stub.ts` (snapshot),
  `lib/external-apis/dubidoc/mapper.ts` (title), client create/edit forms + actions,
  `app/(dashboard)/clients/*` and `app/(dashboard)/acts/page.tsx` (columns).
- No external API contract change (DubiDoc accepts any `title` string); no cron change.
- Only new and re-sent acts get the new DubiDoc title; documents already in DubiDoc keep
  their original title (title is set at send time).

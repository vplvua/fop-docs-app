# Tasks

## 1. Schema & migration

- [x] 1.1 Add nullable `shortName` (`short_name text`) to `lib/db/schema/clients.ts`.
- [x] 1.2 Hand-wrote `0015_add_client_short_name.sql` + journal entry (snapshots 0009–0014
      are absent, so `db:generate` diffs stale 0013 and re-emits noise); applied to dev via
      `npm run db:migrate` and verified `short_name text NULL` on the dev branch.
- [x] 1.3 Apply migration to production separately per `docs/operations.md` (applied 2026-06-07).

## 2. Display helper

- [x] 2.1 Add pure `displayClientName(client)` to `lib/clients/display-name.ts`
      (`shortName?.trim() || name`).
- [x] 2.2 Unit tests: short name present, empty string, whitespace-only, NULL → fallback.

## 3. Client snapshot

- [x] 3.1 Add `shortName: string | null` to `ClientSnapshot` (`lib/classification/types.ts`).
- [x] 3.2 Capture it in `buildClientSnapshot` (`lib/classification/act-stub.ts`).
- [x] 3.3 Unit test: snapshot carries the client's short name (and null when absent).

## 4. DubiDoc title

- [x] 4.1 In `lib/external-apis/dubidoc/mapper.ts`: extend the local `ActClientSnapshot`
      interface with `name` + `shortName`; read `contractSnapshot.number`.
- [x] 4.2 Build `title = `${shortName ?? name} ${contractNumber} Акт ${number} від ${actDate}``.
- [x] 4.3 Unit tests (folded into `tests/unit/edo/mapper.test.ts`): title with short name;
      fallback to full name when null/whitespace; bare contract number; `filename` unchanged.

## 5. Client form & actions

- [x] 5.1 Add optional "Коротка назва" field to the create form + Zod schema
      (`shortNameSchema` preprocess trims; empty/whitespace → null).
- [x] 5.2 Add the same field to the edit form (Manual-only fieldset) + action; persist;
      refresh `updated_at`.
- [x] 5.3 Unit tests: create + update schemas trim and normalize empty/whitespace → NULL.

## 6. UI columns

- [x] 6.1 Clients list (`app/(dashboard)/clients/page.tsx` select + `clients-table.tsx`):
      show `displayClientName` in "Назва", full name as `title` tooltip; search also
      matches `short_name`.
- [x] 6.2 Acts list (`app/(dashboard)/acts/page.tsx`): select live `clients.name` +
      `clients.shortName`, render `displayClientName` in "Клієнт", full name as tooltip
      (replaced the `clientSnapshot.name` render).

## 7. Sync protection

- [x] 7.1 Regression unit test: `mapRemoteToClientFields` never emits `shortName`, so a
      MoeOSBB sync update leaves an operator-set `short_name` unchanged (protection by omission).

## 8. Quality gates & verification

- [x] 8.1 `npm run qa` 6/6 green.
- [x] 8.2 Sync spec deltas into `openspec/specs/{clients,edo-dubidoc,acts}/spec.md`.
- [ ] 8.3 Manual dev-smoke + Real-behavior-proof: set a short name → create/send an act →
      confirm DubiDoc title reads `{short} {contract} Акт …` and both list columns show it
      (human-gated).

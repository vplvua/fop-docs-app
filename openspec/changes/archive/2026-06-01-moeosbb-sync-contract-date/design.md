## Context

The act PDF prints the contract date from `contracts.signed_date` (S3, `add-contracts`). MoeOSBB holds the same date as `osbb_users.createdt`. The sync (`runMoeosbbSync`, S11) already matches remote clients to local ones by `moeosbb_user_id` and selectively merges six client fields, but `signed_date` lives on a **different table** (`contracts`, one row per client via the unique `contracts_client_id_unique` index) and was never touched.

## Goals / Non-Goals

**Goals**

- Sync `osbb_users.createdt` → `contracts.signed_date` for matched clients that already have a contract.
- Be robust to upstream date formats and never corrupt a stored date with garbage.

**Non-Goals**

- Creating contracts during sync (no `number` from MoeOSBB).
- Touching `signed_date` for unmatched / newly auto-created clients.
- Surfacing the contract date anywhere new in the UI (the act already renders it).

## Decisions

### D1 — Target `contracts.signed_date`, not a new `clients` column

"Дата договору" already has a home: `contracts.signed_date`, the field rendered on acts. Adding a parallel `clients.contract_date` would split the truth and require new UI/PDF wiring. So the sync writes the existing field. Operator-confirmed.

### D2 — Always overwrite (MoeOSBB is source of truth)

Operator-confirmed: the sync overwrites `signed_date` from `createdt` even when it was set manually, rather than filling only-when-empty. This keeps the printed contract date authoritative against upstream and avoids silent divergence.

### D3 — Normalize and skip-on-garbage (`mapRemoteContractDate`)

`createdt` arrives as a string of unknown precision (MySQL `DATE` or `DATETIME`, possibly localized). A pure helper extracts `YYYY-MM-DD`:

- `^(\d{4})-(\d{2})-(\d{2})` → that ISO date (handles `DATETIME` by taking the date part); `0000-00-00` → `null`.
- `^(\d{2})[./](\d{2})[./](\d{4})` → reordered `YYYY-MM-DD` (covers `DD.MM.YYYY` / `DD/MM/YYYY`).
- empty / missing / anything else → `null`.

`null` means "skip this contract update" — a malformed or absent upstream value can never blank out an existing `signed_date`. Because the helper reads `remote.createdt ?? ""`, it is also safe **before** the PHP endpoint ships the column (the field is `undefined` → `null` → no-op).

### D4 — Existing-contract-only, via a forgiving UPDATE

The contract update is `UPDATE contracts SET signed_date = … WHERE client_id = <matched localId>`. A client with no contract simply matches zero rows — no insert, no error. Unmatched remote clients are auto-created as `clients` only (S11 `moeosbb-sync-import`); they get no contract here. Contract updates run under `Promise.allSettled` alongside the client writes, so one failure can't abort the batch; `contractsUpdated` counts the fulfilled ones.

## Risks / Trade-offs

- **Overwrite can clobber a deliberate manual correction.** Accepted per D2 (MoeOSBB authoritative). Mitigated by D3 (garbage never overwrites) and by the `contractsUpdated` count surfacing how many rows changed.
- **Upstream format assumptions.** If `createdt` is delivered in a form D3 doesn't recognize, the date is skipped rather than mis-parsed — fail-safe, but such clients silently keep their old date. The dev smoke (task 5.2) confirms the real format.

## Migration Plan

None. `contracts.signed_date` exists since S3; this change is code-only on the app side. The one external prerequisite (PHP `api.php` returning `createdt`) is human-gated and tracked as an unchecked task.

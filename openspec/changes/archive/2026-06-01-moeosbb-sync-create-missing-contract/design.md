## Context

`moeosbb-sync-contract-date` (archived 2026-06-01) wrote `createdt` into `contracts.signed_date` only via `UPDATE … WHERE client_id = …`, which matches zero rows for a contract-less client — so 24 of 394 matched clients were skipped on the first prod run. The contract `number` convention is already established: the manual create-contract form pre-fills it from `moeosbb_user_id`. This change reuses that convention so the sync can create the missing contract.

## Decisions

### D1 — Create-if-missing for matched clients only

A matched client (`moeosbb_user_id` ↔ remote `id`) with a usable `createdt` but no contract gets a new **standard** contract: `number = String(moeosbb_user_id)`, `signed_date = createdt`, `is_standard = true` (column default). This is exactly what the operator would type in the manual form, so the auto-created row is indistinguishable from a hand-made one and remains fully editable afterwards. **Unmatched** (auto-created) clients are deliberately left out — they are new arrivals that may not be real customers yet, and creating contracts for them would let acts be generated unbid.

### D2 — Update path never clobbers operator fields

For a client that already has a contract, the sync still issues a narrow `UPDATE … SET signed_date, updated_at`. The contract `number`, `is_standard`, `file_url`, and `notes` are untouched — `createdt` is authoritative for the date only, not for the rest of the contract.

### D3 — Pre-query + partition, not UPSERT

`syncContracts` first selects which of the dated matched clients already have a contract (`SELECT client_id FROM contracts WHERE client_id IN (…)`), then splits into an UPDATE batch and an INSERT batch. This is preferred over `INSERT … ON CONFLICT DO UPDATE` because (a) it yields clean separate `contractsUpdated` / `contractsCreated` counts, and (b) the conflict-update set would have to re-list every column to avoid clobbering operator fields anyway. Both batches run under `Promise.allSettled`, so a single failure (e.g. a race that inserts a contract between the select and insert → unique-violation) drops just that one row from the count without aborting the sync.

### D4 — Report created and updated separately

`SyncResult` gains `contractsCreated` next to `contractsUpdated`; the dashboard shows «договорів оновлено N, договорів створено M». The operator can see at a glance how many brand-new contracts the sync minted versus how many dates it refreshed.

## Risks / Trade-offs

- **Auto-minted contracts may carry a placeholder number.** `number = moeosbb_user_id` is a convention, not necessarily the legal contract number. Accepted: it matches the existing manual-form default, the row is editable, and `is_standard = true` flags it as the standard template. The operator can correct the number later; subsequent syncs won't touch it (D2).
- **Select→insert race.** Two concurrent syncs could both decide to insert for the same client; the `contracts_client_id_unique` index makes the loser fail, and `Promise.allSettled` swallows it. Benign in this single-admin app.

## Migration Plan

None. Uses the existing `contracts` table and unique index (S3). The PHP endpoint already emits `createdt`.

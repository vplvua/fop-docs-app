## Context

S11 (moeosbb-sync) was implemented with update-only logic: unmatched remote clients are skipped. This was per FR-SYNC-02 ("Sync застосовується тільки до клієнтів з `moeosbb_user_id IS NOT NULL`"). In practice, the user needs auto-creation for both initial bootstrapping (631 clients) and ongoing operation (new clients appear in MoeOSBB regularly).

The sync orchestrator (`lib/external-apis/moeosbb/sync.ts`) already fetches all remote clients and builds a `localByMoeosbbId` map. The change is minimal: for unmatched remote IDs, INSERT a new Client row instead of `continue`.

## Goals / Non-Goals

**Goals:**

- Auto-create Client records for MoeOSBB clients not yet in the system.
- Assign sensible defaults for fields not available from MoeOSBB.
- Report `created` count in sync results and UI.

**Non-Goals:**

- No deletion of local clients that are absent from MoeOSBB (soft-archive is manual).
- No matching by name/legal_id — only by `moeosbb_user_id ↔ remote.id`.
- No changes to the selective merge logic for existing clients.

## Decisions

### D1: INSERT via mapRemoteToClientFields + defaults

New clients are created using the same `mapRemoteToClientFields` mapper plus default values: `moeosbbUserId = Number(remote.id)`, `edoProvider = "dubidoc"`, `autoActDisabled = false`. Fields `apartmentsCount` and `accessPriceOverride` remain NULL — admin sets them manually.

**Why reuse mapper:** Same 6 fields, same mapping. Adding defaults on top avoids a separate creation path.

### D2: Collect inserts alongside updates in Promise.allSettled

The existing loop separates matched/unmatched. Unmatched go into an `inserts` array processed via `Promise.allSettled` alongside updates. Same error handling pattern.

### D3: Single-client sync skips creation

When `syncSingleClientAction` is called from a client card, `singleMoeosbbId` is set. If that ID doesn't match any remote client, it means the local client's `moeosbb_user_id` is wrong — creating a new client doesn't make sense. Auto-creation only applies to full sync.

## Risks / Trade-offs

- **[Low] Duplicate on re-sync**: If sync runs twice rapidly, the second run would try to INSERT clients that the first already created. Mitigation: `moeosbb_user_id` has a UNIQUE constraint — the INSERT will fail, and `Promise.allSettled` handles the rejection gracefully without stopping other operations.

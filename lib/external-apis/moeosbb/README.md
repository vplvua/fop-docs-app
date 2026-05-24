# `lib/external-apis/moeosbb`

Placeholder. Implemented in **S11 (moeosbb-sync)**.

Will contain: read-only MySQL client over `MOEOSBB_DB_URL` (GRANT SELECT only,
NFR-SEC-08). One query helper per use case; no ORM (separate DB engine from
the rest of the app — keep the surface small).

Refs: [`docs/prd.md`](../../../docs/prd.md) FR-SYNC-01..06, TC-INTEG-03,
[ADR D-004](../../../docs/adr/D-004-local-db-sync.md),
[ADR D-021](../../../docs/adr/D-021-moeosbb-rename.md).

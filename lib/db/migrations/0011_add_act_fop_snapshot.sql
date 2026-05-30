-- Add an immutable executor (FOP) requisites snapshot to acts, mirroring the
-- existing client_snapshot / contract_snapshot columns. Nullable: pre-existing
-- acts are backfilled during the one-off mass regeneration (lib/acts/
-- regenerate-all.ts). See change `match-act-to-sample` and ADR D-005.
ALTER TABLE "acts" ADD COLUMN "fop_snapshot" jsonb;

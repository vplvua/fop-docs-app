-- Payment provenance for the by-date statement import + future manual acts
-- (change `add-privatbank-statement-by-date`).
--
-- `source` defaults to 'privatbank' and is NOT NULL, so every pre-existing
-- payment is backfilled to 'privatbank' in the same ADD COLUMN (both polling and
-- by-date import live in the same REF+REFN id space). `bank_label` is nullable —
-- the originating bank for non-PrivatBank payments, always null for PrivatBank.
CREATE TYPE "public"."payment_source" AS ENUM('privatbank', 'manual_external');--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "source" "payment_source" DEFAULT 'privatbank' NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "bank_label" text;

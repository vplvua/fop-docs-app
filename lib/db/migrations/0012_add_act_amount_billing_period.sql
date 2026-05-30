-- Add the act's authoritative paid total (`amount`) and `billing_period` to
-- support the annual prepay discount (change `add-annual-tariff`).
--
-- `amount` is the real sum paid; for every pre-existing act it equals
-- unit_price × quantity, so it is added nullable, backfilled from that product,
-- then made NOT NULL. `billing_period` defaults to 'monthly', so existing rows
-- are correct with no data step (only discounted yearly payments are 'annual').
CREATE TYPE "public"."billing_period" AS ENUM('monthly', 'annual');--> statement-breakpoint
ALTER TABLE "acts" ADD COLUMN "amount" numeric(10, 2);--> statement-breakpoint
UPDATE "acts" SET "amount" = "unit_price" * "quantity" WHERE "amount" IS NULL;--> statement-breakpoint
ALTER TABLE "acts" ALTER COLUMN "amount" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "acts" ADD COLUMN "billing_period" "billing_period" DEFAULT 'monthly' NOT NULL;

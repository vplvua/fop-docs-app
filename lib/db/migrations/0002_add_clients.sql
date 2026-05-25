CREATE TYPE "public"."edo_provider" AS ENUM('dubidoc', 'vchasno_external');--> statement-breakpoint
CREATE TABLE "clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"moeosbb_user_id" bigint,
	"name" text NOT NULL,
	"legal_id" text NOT NULL,
	"address" text DEFAULT '' NOT NULL,
	"bank_name" text,
	"bank_account" text,
	"email" text NOT NULL,
	"apartments_count" integer,
	"access_price_override" numeric(10, 2),
	"auto_act_disabled" boolean DEFAULT false NOT NULL,
	"edo_provider" "edo_provider" DEFAULT 'dubidoc' NOT NULL,
	"last_sync_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "clients_moeosbb_user_id_unique" UNIQUE("moeosbb_user_id")
);
--> statement-breakpoint
CREATE INDEX "clients_auto_act_disabled_idx" ON "clients" USING btree ("auto_act_disabled");--> statement-breakpoint
CREATE INDEX "clients_legal_id_idx" ON "clients" USING btree ("legal_id");
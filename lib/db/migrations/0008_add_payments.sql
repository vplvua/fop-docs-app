CREATE TYPE "public"."payment_status" AS ENUM('received', 'classified', 'awaiting_review', 'in_queue', 'skipped');--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bank_transaction_id" text NOT NULL,
	"payment_date" date NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"purpose" text NOT NULL,
	"payer_name" text NOT NULL,
	"payer_legal_id" text NOT NULL,
	"payer_bank_account" text,
	"raw_data" jsonb NOT NULL,
	"status" "payment_status" DEFAULT 'received' NOT NULL,
	"classification_reason" text,
	"parsed_contract_numbers" text[],
	"client_id" uuid,
	"service_type" text,
	"unit_price" numeric(10, 2),
	"quantity" numeric(10, 2),
	"quantity_unit" text,
	"act_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_bank_transaction_id_unique" UNIQUE("bank_transaction_id")
);
--> statement-breakpoint
CREATE INDEX "payments_status_idx" ON "payments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "payments_payment_date_idx" ON "payments" USING btree ("payment_date");--> statement-breakpoint
CREATE INDEX "payments_client_id_idx" ON "payments" USING btree ("client_id");
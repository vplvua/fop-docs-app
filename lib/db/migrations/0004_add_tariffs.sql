CREATE TABLE "sms_prices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"effective_from" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tariffs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"apartments_min" integer DEFAULT 0 NOT NULL,
	"apartments_max" integer,
	"price" numeric(10, 2) NOT NULL,
	"effective_from" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "sms_prices_effective_from_unique" ON "sms_prices" USING btree ("effective_from");--> statement-breakpoint
CREATE UNIQUE INDEX "tariffs_range_effective_unique" ON "tariffs" USING btree ("apartments_min","apartments_max","effective_from");
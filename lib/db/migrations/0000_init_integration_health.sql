CREATE TABLE "integration_health" (
	"service" text PRIMARY KEY NOT NULL,
	"last_success_at" timestamp with time zone,
	"last_error_at" timestamp with time zone,
	"last_error_message" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

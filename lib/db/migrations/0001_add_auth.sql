CREATE TABLE "login_attempts" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"ip" "inet" NOT NULL,
	"attempted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"success" boolean NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip" "inet"
);
--> statement-breakpoint
CREATE INDEX "login_attempts_ip_attempted_at_idx" ON "login_attempts" USING btree ("ip","attempted_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "sessions_expires_at_idx" ON "sessions" USING btree ("expires_at");
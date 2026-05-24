import { sql } from "drizzle-orm";
import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Per-integration liveness ledger. One row per external service
 * (`privatbank`, `dubidoc`, `moeosbb`, ...). Cron handlers UPSERT on `service`
 * after each cycle; the dashboard (S13) reads it to render health banners.
 */
export const integrationHealth = pgTable("integration_health", {
  service: text("service").primaryKey(),
  lastSuccessAt: timestamp("last_success_at", { withTimezone: true }),
  lastErrorAt: timestamp("last_error_at", { withTimezone: true }),
  lastErrorMessage: text("last_error_message"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

export type IntegrationHealth = typeof integrationHealth.$inferSelect;
export type NewIntegrationHealth = typeof integrationHealth.$inferInsert;

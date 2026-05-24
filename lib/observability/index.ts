import { sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { integrationHealth, type IntegrationHealth } from "@/lib/db/schema/observability";
import { logger } from "@/lib/logging";

/**
 * Stable identifiers for external services tracked in `integration_health`.
 * Extend this union when a new integration cron is added (S6 / S9 / S11).
 */
export type IntegrationService = "privatbank" | "dubidoc" | "moeosbb";

export async function recordIntegrationSuccess(service: IntegrationService): Promise<void> {
  const now = new Date();
  await db
    .insert(integrationHealth)
    .values({ service, lastSuccessAt: now, updatedAt: now })
    .onConflictDoUpdate({
      target: integrationHealth.service,
      set: { lastSuccessAt: now, updatedAt: now },
    });
}

export async function recordIntegrationError(
  service: IntegrationService,
  error: unknown,
): Promise<void> {
  const now = new Date();
  const message = error instanceof Error ? error.message : String(error);
  logger.error({ service, err: error }, "integration error");
  await db
    .insert(integrationHealth)
    .values({ service, lastErrorAt: now, lastErrorMessage: message, updatedAt: now })
    .onConflictDoUpdate({
      target: integrationHealth.service,
      set: { lastErrorAt: now, lastErrorMessage: message, updatedAt: now },
    });
}

export function getIntegrationHealth(): Promise<IntegrationHealth[]> {
  return db
    .select()
    .from(integrationHealth)
    .orderBy(sql`service asc`);
}

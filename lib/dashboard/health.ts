import type { IntegrationHealth } from "@/lib/db/schema/observability";

export type HealthState = "ok" | "error" | "unknown";

export interface DerivedHealth {
  state: HealthState;
  lastSuccessAt: Date | null;
  lastErrorAt: Date | null;
  lastErrorMessage: string | null;
}

/**
 * Derive a dashboard banner state from an `integration_health` row.
 *
 * - `error` — there is an error strictly newer than the last success (or there
 *   is an error and no success at all).
 * - `ok` — there is a last success and no newer error.
 * - `unknown` — the integration has neither succeeded nor errored (or has no
 *   row yet).
 *
 * Pure — no Next.js / DB imports.
 */
export function deriveHealth(row: IntegrationHealth | undefined): DerivedHealth {
  const lastSuccessAt = row?.lastSuccessAt ?? null;
  const lastErrorAt = row?.lastErrorAt ?? null;
  const lastErrorMessage = row?.lastErrorMessage ?? null;

  let state: HealthState;
  if (lastErrorAt && (!lastSuccessAt || lastErrorAt > lastSuccessAt)) {
    state = "error";
  } else if (lastSuccessAt) {
    state = "ok";
  } else {
    state = "unknown";
  }

  return { state, lastSuccessAt, lastErrorAt, lastErrorMessage };
}

/**
 * Fixed set of tracked integrations with their Ukrainian display names. Drives
 * the dashboard so a service that has never run still renders a banner.
 */
export const DASHBOARD_INTEGRATIONS = [
  { service: "privatbank", name: "ПриватБанк" },
  { service: "dubidoc", name: "Дубідок" },
  { service: "moeosbb", name: "Моє ОСББ" },
] as const;

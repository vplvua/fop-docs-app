import { checkCompleteness } from "@/lib/classification/check-completeness";
import type { Client } from "@/lib/db/schema/clients";
import type { Contract } from "@/lib/db/schema/contracts";

export type ReadinessLevel = "red" | "yellow" | "green";

export interface Readiness {
  level: ReadinessLevel;
  /** Missing-field codes from `checkCompleteness` (e.g. "contract", "bank_account"). */
  missing: string[];
}

/** Required for any act; absence of any of these is a hard blocker (red). */
const REQUIRED_CODES = new Set(["email", "address", "bank_name", "bank_account", "contract"]);

/**
 * Act-readiness for a client at list level. Reuses `checkCompleteness` with the
 * access service so the conditional `apartments_count` gap surfaces; contract and
 * required-field checks are service-independent.
 *
 * - red    — no contract, or any required client field missing
 * - yellow — required fields complete, but access needs `apartments_count`
 *            (and there is no `access_price_override`)
 * - green  — everything required to create an act is present
 */
export function computeReadiness(client: Client, contract: Contract | null): Readiness {
  const missing = checkCompleteness(client, contract, "access");
  const hasRequiredGap = missing.some((code) => REQUIRED_CODES.has(code));

  const level: ReadinessLevel = hasRequiredGap
    ? "red"
    : missing.includes("apartments_count")
      ? "yellow"
      : "green";

  return { level, missing };
}

/** Ukrainian label for each missing-field code. */
export const READINESS_LABELS: Record<string, string> = {
  contract: "договір",
  email: "email",
  address: "адреса",
  bank_name: "банк",
  bank_account: "IBAN",
  apartments_count: "кількість квартир",
};

/** Maps missing-field codes to their Ukrainian labels (unknown codes pass through). */
export function readinessMissingLabels(missing: string[]): string[] {
  return missing.map((code) => READINESS_LABELS[code] ?? code);
}

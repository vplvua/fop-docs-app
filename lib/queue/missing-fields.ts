import { checkCompleteness } from "@/lib/classification/check-completeness";
import type { Client } from "@/lib/db/schema/clients";
import type { Contract } from "@/lib/db/schema/contracts";

import type { ServiceType } from "@/lib/classification/types";

/** Which client-card tab the operator should open to fix a missing field. */
export type FieldTab = "info" | "contract";

export interface MissingField {
  /** Field key as produced by the classifier completeness check. */
  field: string;
  /** Operator-facing label (Ukrainian). */
  label: string;
  /** Client-card tab that holds the field (used to build the deep-link). */
  tab: FieldTab;
}

const FIELD_META: Record<string, { label: string; tab: FieldTab }> = {
  email: { label: "Email", tab: "info" },
  address: { label: "Адреса", tab: "info" },
  bank_name: { label: "Назва банку", tab: "info" },
  bank_account: { label: "Рахунок (IBAN)", tab: "info" },
  apartments_count: { label: "Кількість квартир", tab: "info" },
  contract: { label: "Договір", tab: "contract" },
};

/**
 * Compute the ordered list of missing required fields for a payment routed to
 * `client_incomplete`, with the client-card tab that holds each field. Delegates
 * the rule to the classifier's {@link checkCompleteness} so the queue's
 * missing-list can never diverge from the pipeline (D-017).
 */
export function computeMissingFields(
  client: Client,
  contract: Contract | null,
  serviceType: ServiceType,
): MissingField[] {
  return checkCompleteness(client, contract, serviceType).map((field) => {
    const meta = FIELD_META[field];
    return { field, label: meta?.label ?? field, tab: meta?.tab ?? "info" };
  });
}

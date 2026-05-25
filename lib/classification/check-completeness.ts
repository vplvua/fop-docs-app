import type { Client } from "@/lib/db/schema/clients";
import type { Contract } from "@/lib/db/schema/contracts";

import type { ServiceType } from "./types";

export function checkCompleteness(
  client: Client,
  contract: Contract | null,
  serviceType: ServiceType,
): string[] {
  const missing: string[] = [];

  if (!client.email) missing.push("email");
  if (!client.address) missing.push("address");
  if (!client.bankName) missing.push("bank_name");
  if (!client.bankAccount) missing.push("bank_account");
  if (!contract) missing.push("contract");

  if (
    serviceType === "access" &&
    client.accessPriceOverride === null &&
    client.apartmentsCount === null
  ) {
    missing.push("apartments_count");
  }

  return missing;
}

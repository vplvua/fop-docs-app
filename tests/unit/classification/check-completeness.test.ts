import { describe, expect, it } from "vitest";

import { checkCompleteness } from "@/lib/classification/check-completeness";
import type { Client } from "@/lib/db/schema/clients";
import type { Contract } from "@/lib/db/schema/contracts";

function makeClient(overrides: Partial<Client> = {}): Client {
  return {
    id: crypto.randomUUID(),
    moeosbbUserId: null,
    name: "ОСББ Тест",
    legalId: "12345678",
    address: "вул. Тестова 1",
    bankName: "ПриватБанк",
    bankAccount: "UA1234",
    email: "test@example.com",
    apartmentsCount: 50,
    accessPriceOverride: null,
    autoActDisabled: false,
    edoProvider: "dubidoc",
    lastSyncAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

const contract: Contract = {
  id: crypto.randomUUID(),
  clientId: "x",
  number: "556770",
  signedDate: "2024-01-01",
  isStandard: true,
  fileUrl: null,
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("checkCompleteness", () => {
  it("returns empty for complete client", () => {
    expect(checkCompleteness(makeClient(), contract, "access")).toEqual([]);
  });

  it("reports missing email", () => {
    const result = checkCompleteness(makeClient({ email: "" }), contract, "access");
    expect(result).toContain("email");
  });

  it("reports missing bank_name", () => {
    const result = checkCompleteness(makeClient({ bankName: null }), contract, "access");
    expect(result).toContain("bank_name");
  });

  it("reports missing contract", () => {
    const result = checkCompleteness(makeClient(), null, "access");
    expect(result).toContain("contract");
  });

  it("reports missing apartments_count for access without override", () => {
    const client = makeClient({ apartmentsCount: null, accessPriceOverride: null });
    const result = checkCompleteness(client, contract, "access");
    expect(result).toContain("apartments_count");
  });

  it("does not report apartments_count for access with override", () => {
    const client = makeClient({ apartmentsCount: null, accessPriceOverride: "500.00" });
    const result = checkCompleteness(client, contract, "access");
    expect(result).not.toContain("apartments_count");
  });

  it("does not report apartments_count for sms", () => {
    const client = makeClient({ apartmentsCount: null, accessPriceOverride: null });
    const result = checkCompleteness(client, contract, "sms");
    expect(result).not.toContain("apartments_count");
  });
});

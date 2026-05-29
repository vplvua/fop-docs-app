import { describe, expect, it } from "vitest";

import { checkCompleteness } from "@/lib/classification/check-completeness";
import { computeMissingFields } from "@/lib/queue/missing-fields";
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

describe("computeMissingFields", () => {
  it("returns missing client fields with labels and the info tab", () => {
    const client = makeClient({ email: "", bankAccount: null });
    const result = computeMissingFields(client, contract, "access");
    expect(result.map((f) => f.field)).toEqual(["email", "bank_account"]);
    expect(result.every((f) => f.tab === "info")).toBe(true);
    expect(result.every((f) => f.label.length > 0)).toBe(true);
  });

  it("flags a missing contract with the contract tab", () => {
    const result = computeMissingFields(makeClient(), null, "access");
    const contractEntry = result.find((f) => f.field === "contract");
    expect(contractEntry?.tab).toBe("contract");
  });

  it("includes apartments_count for access without override when null", () => {
    const client = makeClient({ apartmentsCount: null, accessPriceOverride: null });
    const result = computeMissingFields(client, contract, "access");
    expect(result.map((f) => f.field)).toContain("apartments_count");
  });

  it("omits apartments_count when an access price override is present", () => {
    const client = makeClient({ apartmentsCount: null, accessPriceOverride: "200.00" });
    const result = computeMissingFields(client, contract, "access");
    expect(result.map((f) => f.field)).not.toContain("apartments_count");
  });

  it("returns no missing fields for a complete client", () => {
    expect(computeMissingFields(makeClient(), contract, "access")).toEqual([]);
  });

  it("stays in parity with the classifier completeness rule", () => {
    const client = makeClient({ email: "", address: "", apartmentsCount: null });
    for (const serviceType of ["access", "sms"] as const) {
      const expected = checkCompleteness(client, null, serviceType);
      const actual = computeMissingFields(client, null, serviceType).map((f) => f.field);
      expect(actual).toEqual(expected);
    }
  });
});

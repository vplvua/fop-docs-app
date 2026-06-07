import { describe, expect, it } from "vitest";

import { computeReadiness } from "@/lib/clients/readiness";
import type { Client } from "@/lib/db/schema/clients";
import type { Contract } from "@/lib/db/schema/contracts";

function makeClient(overrides: Partial<Client> = {}): Client {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    moeosbbUserId: 1,
    name: "ОСББ Тест",
    shortName: null,
    legalId: "12345678",
    address: "вул. Тестова, 1",
    bankName: "ПриватБанк",
    bankAccount: "UA000000000000000000000000000",
    email: "test@example.com",
    apartmentsCount: 50,
    accessPriceOverride: null,
    autoActDisabled: false,
    edoProvider: "dubidoc",
    lastSyncAt: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...overrides,
  };
}

function makeContract(overrides: Partial<Contract> = {}): Contract {
  return {
    id: "00000000-0000-0000-0000-0000000000a1",
    clientId: "00000000-0000-0000-0000-000000000001",
    number: "Д-1",
    signedDate: "2026-01-01",
    isStandard: true,
    fileUrl: null,
    notes: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...overrides,
  };
}

describe("computeReadiness", () => {
  it("red when the client has no contract", () => {
    const r = computeReadiness(makeClient(), null);
    expect(r.level).toBe("red");
    expect(r.missing).toContain("contract");
  });

  it("red when a required field (bank account) is missing", () => {
    const r = computeReadiness(makeClient({ bankAccount: null }), makeContract());
    expect(r.level).toBe("red");
    expect(r.missing).toContain("bank_account");
  });

  it("yellow when apartments_count is missing and there is no price override", () => {
    const r = computeReadiness(
      makeClient({ apartmentsCount: null, accessPriceOverride: null }),
      makeContract(),
    );
    expect(r.level).toBe("yellow");
    expect(r.missing).toEqual(["apartments_count"]);
  });

  it("green when everything required is present", () => {
    const r = computeReadiness(makeClient({ apartmentsCount: 50 }), makeContract());
    expect(r.level).toBe("green");
    expect(r.missing).toEqual([]);
  });

  it("green when access is covered by a price override", () => {
    const r = computeReadiness(
      makeClient({ apartmentsCount: null, accessPriceOverride: "150.00" }),
      makeContract(),
    );
    expect(r.level).toBe("green");
    expect(r.missing).toEqual([]);
  });
});

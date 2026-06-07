import { describe, expect, it } from "vitest";

import { buildManualActStub } from "@/lib/classification/act-stub";
import type { Client } from "@/lib/db/schema/clients";
import type { Contract } from "@/lib/db/schema/contracts";
import { SERVICE_NAME_DEFAULTS } from "@/lib/services/schema";

function makeClient(overrides: Partial<Client> = {}): Client {
  return {
    id: "client-1",
    moeosbbUserId: null,
    name: "ОСББ Тест",
    shortName: null,
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

function makeContract(): Contract {
  return {
    id: "contract-1",
    clientId: "client-1",
    number: "556770",
    signedDate: "2024-01-01",
    isStandard: true,
    fileUrl: null,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe("buildManualActStub", () => {
  it("stores the amount as entered, not unitPrice × quantity", () => {
    const stub = buildManualActStub({
      client: makeClient(),
      contract: makeContract(),
      paymentId: "pay-1",
      serviceType: "access",
      unitPrice: "200.00",
      quantity: "12",
      amount: "2000.00", // discounted annual-style total, deliberately ≠ 200×12
      actDate: "2025-12-31",
      serviceNames: SERVICE_NAME_DEFAULTS,
    });
    expect(stub.quantity).toBe("12");
    expect(stub.unitPrice).toBe("200.00");
    expect(stub.amount).toBe("2000.00");
  });

  it("uses the period-derived act date verbatim and is always monthly", () => {
    const stub = buildManualActStub({
      client: makeClient(),
      contract: makeContract(),
      paymentId: "pay-1",
      serviceType: "access",
      unitPrice: "200.00",
      quantity: "1",
      amount: "200.00",
      actDate: "2025-12-31",
      serviceNames: SERVICE_NAME_DEFAULTS,
    });
    expect(stub.actDate).toBe("2025-12-31");
    expect(stub.billingPeriod).toBe("monthly");
    expect(stub.quantityUnit).toBe("шт.");
  });

  it("captures client/contract snapshots and leaves number/fopSnapshot for the caller", () => {
    const stub = buildManualActStub({
      client: makeClient({ name: "ОСББ Зоря" }),
      contract: makeContract(),
      paymentId: "pay-1",
      serviceType: "sms",
      unitPrice: "1.40",
      quantity: "100",
      amount: "140.00",
      actDate: "2025-12-31",
      serviceNames: SERVICE_NAME_DEFAULTS,
    });
    expect(stub.clientSnapshot.name).toBe("ОСББ Зоря");
    expect(stub.contractSnapshot.number).toBe("556770");
    expect(stub.serviceDescription).toBe(SERVICE_NAME_DEFAULTS.sms);
    expect(stub.paymentId).toBe("pay-1");
    expect(stub.number).toBe(""); // assigned via nextActNumber in the transaction
    expect(stub.fopSnapshot).toBeNull(); // set from requisites by the orchestrator
  });
});

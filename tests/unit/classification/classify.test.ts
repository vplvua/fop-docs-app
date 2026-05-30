import { describe, expect, it } from "vitest";

import { classify } from "@/lib/classification/classify";
import type { ClassificationInput } from "@/lib/classification/types";
import { SERVICE_NAME_DEFAULTS } from "@/lib/services/schema";
import type { Client } from "@/lib/db/schema/clients";
import type { Contract } from "@/lib/db/schema/contracts";
import type { Payment } from "@/lib/db/schema/payments";
import type { PatternEntry } from "@/lib/settings";
import type { SmsPrice, Tariff } from "@/lib/db/schema/tariffs";

function makePayment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: crypto.randomUUID(),
    bankTransactionId: "PB123",
    paymentDate: "2026-04-05",
    amount: "200.00",
    purpose: "Оплата по договір №556770",
    payerName: "ОСББ Тест",
    payerLegalId: "12345678",
    payerBankAccount: "UA1234",
    rawData: {},
    status: "received",
    classificationReason: null,
    parsedContractNumbers: null,
    clientId: null,
    serviceType: null,
    unitPrice: null,
    quantity: null,
    quantityUnit: null,
    actId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeClient(overrides: Partial<Client> = {}): Client {
  return {
    id: "client-1",
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

function makeContract(clientId: string): Contract {
  return {
    id: crypto.randomUUID(),
    clientId,
    number: "556770",
    signedDate: "2024-01-01",
    isStandard: true,
    fileUrl: null,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

const patterns: PatternEntry[] = [{ pattern: "договір\\s*[№#]\\s*(\\d+)", description: "test" }];

const catchAllTariff: Tariff = {
  id: crypto.randomUUID(),
  apartmentsMin: 0,
  apartmentsMax: null,
  price: "200.00",
  effectiveFrom: "2024-01-01",
  createdAt: new Date(),
  updatedAt: new Date(),
};

const smsPrice: SmsPrice = {
  id: crypto.randomUUID(),
  price: "1.40",
  effectiveFrom: "2024-01-01",
  createdAt: new Date(),
};

function makeInput(overrides: Partial<ClassificationInput> = {}): ClassificationInput {
  const client = makeClient();
  const contract = makeContract(client.id);
  return {
    payment: makePayment(),
    clients: [Object.assign(client, { contract })],
    patterns,
    smsKeywords: ["смс", "sms"],
    transitEdrpouList: ["14360570"],
    tariffs: [catchAllTariff],
    smsPrices: [smsPrice],
    serviceNames: SERVICE_NAME_DEFAULTS,
    annualPaidMonths: 10,
    existingActCount: 0,
    ...overrides,
  };
}

describe("classify — happy paths", () => {
  it("classifies access payment successfully", () => {
    const result = classify(makeInput());
    expect(result.status).toBe("classified");
    if (result.status === "classified") {
      expect(result.serviceType).toBe("access");
      expect(result.unitPrice).toBe("200.00");
      expect(result.quantity).toBe("1");
      expect(result.quantityUnit).toBe("міс.");
      expect(result.amount).toBe("200.00");
      expect(result.billingPeriod).toBe("monthly");
      expect(result.actStub.amount).toBe("200.00");
      expect(result.actStub.billingPeriod).toBe("monthly");
      expect(result.actStub.actDate).toBe("2026-04-30");
    }
  });

  it("classifies a one-shot yearly payment as a 12-month annual act", () => {
    const result = classify(makeInput({ payment: makePayment({ amount: "2000.00" }) }));
    expect(result.status).toBe("classified");
    if (result.status === "classified") {
      expect(result.quantity).toBe("12");
      expect(result.billingPeriod).toBe("annual");
      expect(result.unitPrice).toBe("200.00");
      // The act's total is the paid amount, not unitPrice × quantity.
      expect(result.amount).toBe("2000.00");
      expect(result.actStub.amount).toBe("2000.00");
      expect(result.actStub.billingPeriod).toBe("annual");
    }
  });

  it("does not give override clients the annual discount (2000 → 10 monthly)", () => {
    const client = makeClient({ accessPriceOverride: "200.00" });
    const contract = makeContract(client.id);
    const result = classify(
      makeInput({
        payment: makePayment({ amount: "2000.00" }),
        clients: [Object.assign(client, { contract })],
      }),
    );
    expect(result.status).toBe("classified");
    if (result.status === "classified") {
      expect(result.quantity).toBe("10");
      expect(result.billingPeriod).toBe("monthly");
    }
  });

  it("classifies SMS payment successfully", () => {
    const input = makeInput({
      payment: makePayment({
        purpose: "Оплата СМС по договір №556770 у кількості 100",
        amount: "140.00",
      }),
    });
    const result = classify(input);
    expect(result.status).toBe("classified");
    if (result.status === "classified") {
      expect(result.serviceType).toBe("sms");
      expect(result.unitPrice).toBe("1.40");
      expect(result.quantity).toBe("100");
    }
  });
});

describe("classify — reason branches", () => {
  it("returns no_match when no client matches", () => {
    const input = makeInput({
      payment: makePayment({ payerLegalId: "99999999", purpose: "Поповнення" }),
    });
    const result = classify(input);
    expect(result.status).toBe("in_queue");
    if (result.status === "in_queue") {
      expect(result.reason).toBe("no_match");
    }
  });

  it("ignores multiple contract numbers when EDRPOU resolves a single active client", () => {
    const p: PatternEntry[] = [{ pattern: "(\\d{6})", description: "any 6 digits" }];
    const input = makeInput({
      payment: makePayment({ purpose: "Договори 556770 та 556771" }),
      patterns: p,
    });
    // Payer EDRPOU maps to exactly one active client → contract numbers are
    // informational; classification proceeds instead of multiple_contracts.
    const result = classify(input);
    expect(result.status).toBe("classified");
  });

  it("returns no_match when the payer EDRPOU has no client", () => {
    const input = makeInput({ payment: makePayment({ payerLegalId: "99999999" }) });
    const result = classify(input);
    expect(result.status).toBe("in_queue");
    if (result.status === "in_queue") {
      expect(result.reason).toBe("no_match");
    }
  });

  it("returns client_incomplete when required fields missing", () => {
    const client = makeClient({ email: "" });
    const contract = makeContract(client.id);
    const input = makeInput({
      clients: [Object.assign(client, { contract })],
    });
    const result = classify(input);
    expect(result.status).toBe("in_queue");
    if (result.status === "in_queue") {
      expect(result.reason).toContain("client_incomplete");
    }
  });

  it("returns auto_act_disabled for disabled clients", () => {
    const client = makeClient({ autoActDisabled: true });
    const contract = makeContract(client.id);
    const input = makeInput({
      clients: [Object.assign(client, { contract })],
    });
    const result = classify(input);
    expect(result.status).toBe("awaiting_review");
    if (result.status === "awaiting_review") {
      expect(result.reason).toBe("auto_act_disabled");
    }
  });

  it("returns external_edo for vchasno clients", () => {
    const client = makeClient({ edoProvider: "vchasno_external" });
    const contract = makeContract(client.id);
    const input = makeInput({
      clients: [Object.assign(client, { contract })],
    });
    const result = classify(input);
    expect(result.status).toBe("awaiting_review");
    if (result.status === "awaiting_review") {
      expect(result.reason).toBe("external_edo");
    }
  });

  it("prefers auto_act_disabled over external_edo", () => {
    const client = makeClient({ autoActDisabled: true, edoProvider: "vchasno_external" });
    const contract = makeContract(client.id);
    const input = makeInput({
      clients: [Object.assign(client, { contract })],
    });
    const result = classify(input);
    expect(result.status).toBe("awaiting_review");
    if (result.status === "awaiting_review") {
      expect(result.reason).toBe("auto_act_disabled");
    }
  });

  it("returns amount_mismatch when amount not divisible by price", () => {
    const input = makeInput({ payment: makePayment({ amount: "550.00" }) });
    const result = classify(input);
    expect(result.status).toBe("in_queue");
    if (result.status === "in_queue") {
      expect(result.reason).toBe("amount_mismatch");
    }
  });

  it("returns sms_quantity_mismatch for unparseable sms quantity", () => {
    const input = makeInput({
      payment: makePayment({ purpose: "Оплата СМС по договір №556770", amount: "140.00" }),
    });
    const result = classify(input);
    expect(result.status).toBe("in_queue");
    if (result.status === "in_queue") {
      expect(result.reason).toBe("sms_quantity_mismatch");
    }
  });
});

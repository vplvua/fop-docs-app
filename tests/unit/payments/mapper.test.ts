import { describe, expect, it } from "vitest";

import { mapTransaction } from "@/lib/external-apis/privatbank/mapper";
import type { PrivatBankTransaction } from "@/lib/external-apis/privatbank/types";

const sampleTx: PrivatBankTransaction = {
  id: "PB12345abcde",
  date: "2026-04-05",
  amount: "200.00",
  purpose: "Оплата по договір №556770",
  payer: {
    name: "ОСББ Тест",
    legal_id: "12345678",
    iban: "UA123456789012345678901234567",
  },
};

describe("mapTransaction", () => {
  it("maps all standard fields", () => {
    const result = mapTransaction(sampleTx);
    expect(result.bankTransactionId).toBe("PB12345abcde");
    expect(result.paymentDate).toBe("2026-04-05");
    expect(result.amount).toBe("200.00");
    expect(result.purpose).toBe("Оплата по договір №556770");
    expect(result.payerName).toBe("ОСББ Тест");
    expect(result.payerLegalId).toBe("12345678");
    expect(result.payerBankAccount).toBe("UA123456789012345678901234567");
    expect(result.status).toBe("received");
  });

  it("stores full transaction as rawData", () => {
    const result = mapTransaction(sampleTx);
    expect(result.rawData).toEqual(sampleTx);
  });

  it("handles missing iban", () => {
    const noIban: PrivatBankTransaction = {
      ...sampleTx,
      payer: { ...sampleTx.payer, iban: undefined as unknown as string },
    };
    const result = mapTransaction(noIban);
    expect(result.payerBankAccount).toBeNull();
  });
});

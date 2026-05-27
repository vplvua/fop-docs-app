import { describe, expect, it } from "vitest";

import { mapTransaction } from "@/lib/external-apis/privatbank/mapper";

import { sampleTransaction } from "../../mocks/handlers/privatbank";

describe("mapTransaction", () => {
  it("maps all standard fields", () => {
    const result = mapTransaction(sampleTransaction);
    expect(result.bankTransactionId).toBe("REF001N001");
    expect(result.paymentDate).toBe("05.04.2026");
    expect(result.amount).toBe("200.00");
    expect(result.purpose).toBe("За надання доступу до сервісу Моє ОСББ, договір №556770. Без ПДВ");
    expect(result.payerName).toBe("ОСББ «Приклад»");
    expect(result.payerBankAccount).toBe("UA123456789012345678901234567");
    expect(result.status).toBe("received");
  });

  it("stores full transaction as rawData", () => {
    const result = mapTransaction(sampleTransaction);
    expect(result.rawData).toEqual(sampleTransaction);
  });
});

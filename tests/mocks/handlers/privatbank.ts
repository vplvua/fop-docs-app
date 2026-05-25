import { http, HttpResponse } from "msw";

import type { PrivatBankTransaction } from "@/lib/external-apis/privatbank/types";

const sampleTransaction: PrivatBankTransaction = {
  id: "PB12345abcde",
  date: "2026-04-05",
  amount: "200.00",
  purpose: "За надання доступу до сервісу Моє ОСББ, договір №556770. Без ПДВ",
  payer: {
    name: "ОСББ «Приклад»",
    legal_id: "12345678",
    iban: "UA123456789012345678901234567",
  },
};

export const privatbankHandlers = [
  http.get("https://acp.privatbank.ua/api/statements/transactions", () =>
    HttpResponse.json([sampleTransaction]),
  ),
];

export { sampleTransaction };

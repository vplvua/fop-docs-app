import { http, HttpResponse } from "msw";

import type {
  PrivatBankTransaction,
  PrivatBankTransactionsResponse,
} from "@/lib/external-apis/privatbank/types";

const sampleTransaction: PrivatBankTransaction = {
  TRANTYPE: "C",
  SUM: "200.00",
  SUM_E: "200.00",
  CCY: "UAH",
  OSND: "За надання доступу до сервісу Моє ОСББ, договір №556770. Без ПДВ",
  AUT_CNTR_NAM: "ОСББ «Приклад»",
  AUT_CNTR_CRF: "38640873",
  AUT_CNTR_ACC: "UA123456789012345678901234567",
  AUT_CNTR_MFO: "305299",
  AUT_MY_ACC: "UA999888777666555444333222111",
  DAT_KL: "05.04.2026",
  DAT_OD: "05.04.2026",
  TIM_P: "12:30:00",
  DATE_TIME_DAT_OD_TIM_P: "05.04.2026 12:30:00",
  ID: "PB12345abcde",
  TECHNICAL_TRANSACTION_ID: "T12345",
  REF: "REF001",
  REFN: "N001",
  NUM_DOC: "123",
  PR_PR: "r",
  FL_REAL: "r",
};

const successResponse: PrivatBankTransactionsResponse = {
  status: "SUCCESS",
  type: "transactions",
  exist_next_page: false,
  next_page_id: null,
  transactions: [sampleTransaction],
};

// A second confirmed transaction on the same day, used by by-date tests.
const sampleTransactionTwo: PrivatBankTransaction = {
  ...sampleTransaction,
  SUM: "350.00",
  SUM_E: "350.00",
  OSND: "За надання доступу до сервісу Моє ОСББ, договір №112233. Без ПДВ",
  AUT_CNTR_NAM: "ОСББ «Сонячне»",
  AUT_CNTR_CRF: "40010203",
  REF: "REF002",
  REFN: "N002",
  ID: "PB67890fghij",
};

const byDateResponse: PrivatBankTransactionsResponse = {
  status: "SUCCESS",
  type: "transactions",
  exist_next_page: false,
  next_page_id: null,
  transactions: [sampleTransaction, sampleTransactionTwo],
};

export const privatbankHandlers = [
  http.get("https://acp.privatbank.ua/api/statements/transactions/interim", () =>
    HttpResponse.json(successResponse),
  ),
  // Dated statement endpoint (by-date import). Registered separately from
  // `/interim` so MSW matches the base path exactly.
  http.get("https://acp.privatbank.ua/api/statements/transactions", () =>
    HttpResponse.json(byDateResponse),
  ),
];

export { sampleTransaction, sampleTransactionTwo };

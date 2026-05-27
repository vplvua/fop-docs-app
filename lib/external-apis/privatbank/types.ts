export interface PrivatBankTransaction {
  TRANTYPE: "C" | "D";
  SUM: string;
  SUM_E: string;
  CCY: string;
  OSND: string;
  AUT_CNTR_NAM: string;
  AUT_CNTR_ACC: string;
  AUT_CNTR_MFO: string;
  AUT_CNTR_MFO_NAME?: string;
  AUT_MY_ACC: string;
  DAT_KL: string;
  DAT_OD: string;
  TIM_P: string;
  DATE_TIME_DAT_OD_TIM_P: string;
  ID: string;
  TECHNICAL_TRANSACTION_ID: string;
  REF: string;
  REFN: string;
  NUM_DOC: string;
  PR_PR: "r" | "p" | "t" | "n";
  FL_REAL: "r" | "i";
}

export interface PrivatBankTransactionsResponse {
  status: "SUCCESS" | "ERROR";
  type: "transactions";
  exist_next_page: boolean;
  next_page_id: string | null;
  transactions: PrivatBankTransaction[];
}

export class PrivatBankAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PrivatBankAuthError";
  }
}

export class PrivatBankApiError extends Error {
  readonly statusCode: number;
  constructor(statusCode: number, message: string) {
    super(message);
    this.name = "PrivatBankApiError";
    this.statusCode = statusCode;
  }
}

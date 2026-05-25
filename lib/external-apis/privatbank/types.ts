export interface PrivatBankPayer {
  name: string;
  legal_id: string;
  iban: string;
}

export interface PrivatBankTransaction {
  id: string;
  date: string;
  amount: string;
  purpose: string;
  payer: PrivatBankPayer;
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

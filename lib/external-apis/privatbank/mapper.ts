import type { NewPayment } from "@/lib/db/schema/payments";

import type { PrivatBankTransaction } from "./types";

function toIsoDate(ddmmyyyy: string): string {
  const [day, month, year] = ddmmyyyy.split(".");
  return `${year}-${month}-${day}`;
}

export function mapTransaction(tx: PrivatBankTransaction): NewPayment {
  return {
    bankTransactionId: `${tx.REF}${tx.REFN}`,
    paymentDate: toIsoDate(tx.DAT_OD),
    amount: tx.SUM,
    purpose: tx.OSND,
    payerName: tx.AUT_CNTR_NAM,
    payerLegalId: tx.AUT_CNTR_CRF,
    payerBankAccount: tx.AUT_CNTR_ACC ?? null,
    rawData: tx,
    status: "received",
  };
}

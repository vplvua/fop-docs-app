import type { NewPayment } from "@/lib/db/schema/payments";

import type { PrivatBankTransaction } from "./types";

export function mapTransaction(tx: PrivatBankTransaction): NewPayment {
  return {
    bankTransactionId: `${tx.REF}${tx.REFN}`,
    paymentDate: tx.DAT_OD,
    amount: tx.SUM,
    purpose: tx.OSND,
    payerName: tx.AUT_CNTR_NAM,
    payerLegalId: "",
    payerBankAccount: tx.AUT_CNTR_ACC ?? null,
    rawData: tx,
    status: "received",
  };
}

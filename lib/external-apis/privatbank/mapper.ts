import type { NewPayment } from "@/lib/db/schema/payments";

import type { PrivatBankTransaction } from "./types";

export function mapTransaction(tx: PrivatBankTransaction): NewPayment {
  return {
    bankTransactionId: tx.id,
    paymentDate: tx.date,
    amount: tx.amount,
    purpose: tx.purpose,
    payerName: tx.payer.name,
    payerLegalId: tx.payer.legal_id,
    payerBankAccount: tx.payer.iban ?? null,
    rawData: tx,
    status: "received",
  };
}

import type { NewPayment } from "@/lib/db/schema/payments";

import type { PrivatBankTransaction } from "./types";

/** A payment that already exists for a given `bank_transaction_id`. */
export interface ExistingPaymentRef {
  bankTransactionId: string;
  id: string;
  status: string;
  actId: string | null;
}

/**
 * A fetched transaction paired with its mapped payment shape and a dedup verdict
 * against what already lives in the `payments` table. `new` rows are importable;
 * `already_imported` rows carry the existing payment so the UI can link to it
 * (and its act) and disable re-import.
 */
export type AnnotatedTransaction =
  | { status: "new"; transaction: PrivatBankTransaction; payment: NewPayment }
  | {
      status: "already_imported";
      transaction: PrivatBankTransaction;
      payment: NewPayment;
      existingPaymentId: string;
      existingStatus: string;
      actId: string | null;
    };

/**
 * Merge mapped transactions with the payments already present for their
 * `bank_transaction_id`s (Layer 1 dedup). Pure — the caller supplies the lookup
 * result from a single `WHERE bank_transaction_id = ANY(...)` query.
 */
export function annotateWithExisting(
  mapped: NewPayment[],
  existing: ExistingPaymentRef[],
): AnnotatedTransaction[] {
  const byId = new Map(existing.map((e) => [e.bankTransactionId, e]));

  return mapped.map((payment) => {
    const transaction = payment.rawData as PrivatBankTransaction;
    const match = byId.get(payment.bankTransactionId);
    if (match) {
      return {
        status: "already_imported",
        transaction,
        payment,
        existingPaymentId: match.id,
        existingStatus: match.status,
        actId: match.actId,
      };
    }
    return { status: "new", transaction, payment };
  });
}

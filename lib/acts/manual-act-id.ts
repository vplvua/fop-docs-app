import { lastDayOfMonth } from "@/lib/classification/act-stub";

/**
 * Synthetic `bank_transaction_id` for a manually-recorded payment. The `manual:`
 * prefix guarantees it can never equal a PrivatBank `REF+REFN` value (bank
 * reference strings), so the shared unique constraint on `bank_transaction_id`
 * holds and the poll's id space stays disjoint from manual entries.
 */
export function manualBankTransactionId(): string {
  return `manual:${crypto.randomUUID()}`;
}

/**
 * Act date for a manual act: the last calendar day of the chosen period month,
 * decoupled from when the money actually arrived (D3). `month` is 1-12.
 */
export function manualActDate(year: number, month: number): string {
  const mm = String(month).padStart(2, "0");
  return lastDayOfMonth(`${year}-${mm}-01`);
}

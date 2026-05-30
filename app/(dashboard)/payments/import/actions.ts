"use server";

import { inArray } from "drizzle-orm";

import { runClassification } from "@/lib/classification/run-classification";
import { db } from "@/lib/db";
import { payments } from "@/lib/db/schema/payments";
import {
  annotateWithExisting,
  type AnnotatedTransaction,
} from "@/lib/external-apis/privatbank/annotate";
import { fetchTransactionsByDate } from "@/lib/external-apis/privatbank/client";
import { mapTransaction } from "@/lib/external-apis/privatbank/mapper";
import { logger } from "@/lib/logging";
import { recordIntegrationError, recordIntegrationSuccess } from "@/lib/observability";

// Plain, serialisable rows for the client. `payment`/`transaction` stay on the
// server; the client only needs what it renders plus the ids needed to import.
export interface StatementRow {
  bankTransactionId: string;
  paymentDate: string;
  amount: string;
  purpose: string;
  payerName: string;
  status: "new" | "already_imported";
  existingPaymentId?: string;
  existingStatus?: string;
  actId?: string | null;
}

export interface FetchStatementResult {
  rows?: StatementRow[];
  error?: string;
}

function toRow(a: AnnotatedTransaction): StatementRow {
  const base = {
    bankTransactionId: a.payment.bankTransactionId,
    paymentDate: a.payment.paymentDate,
    amount: a.payment.amount,
    purpose: a.payment.purpose,
    payerName: a.payment.payerName,
  };
  if (a.status === "already_imported") {
    return {
      ...base,
      status: "already_imported",
      existingPaymentId: a.existingPaymentId,
      existingStatus: a.existingStatus,
      actId: a.actId,
    };
  }
  return { ...base, status: "new" };
}

/** Fetch a PrivatBank statement for a date (range) and annotate dedup state. */
export async function fetchStatementByDateAction(
  startDate: string,
  endDate?: string,
): Promise<FetchStatementResult> {
  const token = process.env.PRIVATBANK_TOKEN;
  const account = process.env.FOP_BANK_ACCOUNT;
  if (!token || !account) {
    return { error: "PRIVATBANK_TOKEN або FOP_BANK_ACCOUNT не налаштовано" };
  }

  try {
    const transactions = await fetchTransactionsByDate(token, account, startDate, endDate);
    const mapped = transactions.map((tx) => mapTransaction(tx));
    await recordIntegrationSuccess("privatbank");

    if (mapped.length === 0) return { rows: [] };

    const ids = mapped.map((m) => m.bankTransactionId);
    const existing = await db
      .select({
        bankTransactionId: payments.bankTransactionId,
        id: payments.id,
        status: payments.status,
        actId: payments.actId,
      })
      .from(payments)
      .where(inArray(payments.bankTransactionId, ids));

    const annotated = annotateWithExisting(mapped, existing);
    return { rows: annotated.map(toRow) };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await recordIntegrationError("privatbank", err);
    logger.error(
      { event: "privatbank.by_date_fetch_error", error: message },
      "by-date fetch failed",
    );
    return { error: message };
  }
}

export interface ImportResult {
  paymentId?: string;
  alreadyExisted?: boolean;
  error?: string;
}

/**
 * Import a single transaction selected from a fetched statement. The bank is the
 * source of truth: we re-fetch the statement for the given date and match by
 * `bank_transaction_id`, so the inserted row never trusts client-supplied
 * amounts/dates. Insert is guarded by `ON CONFLICT DO NOTHING` (Layer 2 dedup);
 * a conflict routes the admin to the existing payment instead of duplicating.
 */
export async function importStatementTransactionAction(
  bankTransactionId: string,
  startDate: string,
  endDate?: string,
): Promise<ImportResult> {
  const token = process.env.PRIVATBANK_TOKEN;
  const account = process.env.FOP_BANK_ACCOUNT;
  if (!token || !account) {
    return { error: "PRIVATBANK_TOKEN або FOP_BANK_ACCOUNT не налаштовано" };
  }

  let row;
  try {
    const transactions = await fetchTransactionsByDate(token, account, startDate, endDate);
    const match = transactions.find((tx) => `${tx.REF}${tx.REFN}` === bankTransactionId);
    if (!match) {
      return { error: "Транзакцію не знайдено у виписці за цю дату" };
    }
    row = mapTransaction(match);
    await recordIntegrationSuccess("privatbank");
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await recordIntegrationError("privatbank", err);
    return { error: message };
  }

  const inserted = await db
    .insert(payments)
    .values({ ...row, source: "privatbank" })
    .onConflictDoNothing({ target: payments.bankTransactionId })
    .returning({ id: payments.id });

  if (inserted.length === 0) {
    // Conflict: a poll (or a prior import) already created this payment.
    const [existing] = await db
      .select({ id: payments.id })
      .from(payments)
      .where(inArray(payments.bankTransactionId, [bankTransactionId]))
      .limit(1);
    return existing ? { paymentId: existing.id, alreadyExisted: true } : { alreadyExisted: true };
  }

  const paymentId = inserted[0]!.id;
  // Trigger classification the same way polling does — fire-and-forget, a
  // failure leaves the payment for manual classification in the queue.
  runClassification(paymentId).catch((err: unknown) => {
    const message = err instanceof Error ? err.message : "Unknown";
    logger.warn({ event: "import.classify_error", paymentId, error: message }, "classify failed");
  });

  return { paymentId };
}

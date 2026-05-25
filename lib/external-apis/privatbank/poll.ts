import { db } from "@/lib/db";
import { payments } from "@/lib/db/schema/payments";
import { logger } from "@/lib/logging";
import { recordIntegrationError, recordIntegrationSuccess } from "@/lib/observability";
import { getPollingIntervals } from "@/lib/settings";

import { fetchTransactions } from "./client";
import { mapTransaction } from "./mapper";

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

interface PollResult {
  inserted: number;
  total: number;
  insertedIds: string[];
}

export async function pollPrivatbank(): Promise<PollResult> {
  const token = process.env.PRIVATBANK_TOKEN;
  if (!token) {
    logger.error({ event: "privatbank.no_token" }, "PRIVATBANK_TOKEN not set");
    await recordIntegrationError("privatbank", new Error("PRIVATBANK_TOKEN not set"));
    return { inserted: 0, total: 0, insertedIds: [] };
  }

  const { privatbankMinutes } = await getPollingIntervals();
  const now = new Date();
  const windowMs = privatbankMinutes * 2 * 60 * 1000;
  const dateFrom = formatDate(new Date(now.getTime() - windowMs));
  const dateTo = formatDate(now);

  try {
    const transactions = await fetchTransactions(token, dateFrom, dateTo);
    logger.info(
      { event: "privatbank.fetched", count: transactions.length, dateFrom, dateTo },
      "fetched transactions from PrivatBank",
    );

    const mapped = transactions.map((tx) => mapTransaction(tx));
    const results = await Promise.all(
      mapped.map((row) =>
        db
          .insert(payments)
          .values(row)
          .onConflictDoNothing({ target: payments.bankTransactionId })
          .returning({ id: payments.id }),
      ),
    );
    const insertedIds = results.filter((r) => r.length > 0).map((r) => r[0]!.id);

    await recordIntegrationSuccess("privatbank");
    logger.info(
      {
        event: "privatbank.poll_complete",
        inserted: insertedIds.length,
        total: transactions.length,
      },
      "poll complete",
    );
    return { inserted: insertedIds.length, total: transactions.length, insertedIds };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await recordIntegrationError("privatbank", err);
    logger.error({ event: "privatbank.poll_error", error: message }, "poll failed");
    throw err;
  }
}

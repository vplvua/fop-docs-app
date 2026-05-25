import { NextResponse } from "next/server";

import { runClassification } from "@/lib/classification/run-classification";
import { logger } from "@/lib/logging";
import { pollPrivatbank } from "@/lib/external-apis/privatbank/poll";

async function classifyInserted(ids: string[]): Promise<number> {
  const results = await Promise.allSettled(ids.map((id) => runClassification(id)));
  for (const [i, r] of results.entries()) {
    if (r.status === "rejected") {
      const msg = r.reason instanceof Error ? r.reason.message : "Unknown";
      logger.warn(
        { event: "cron.classify_error", paymentId: ids[i], error: msg },
        "classify failed",
      );
    }
  }
  return results.filter((r) => r.status === "fulfilled" && r.value.status === "classified").length;
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await pollPrivatbank();
    const classified = await classifyInserted(result.insertedIds);
    logger.info({ event: "cron.privatbank_poll", ...result, classified }, "cron poll complete");
    return NextResponse.json({ ...result, classified });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    logger.error({ event: "cron.privatbank_poll_error", error: message }, "cron poll failed");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

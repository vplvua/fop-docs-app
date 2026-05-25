import { NextResponse } from "next/server";

import { logger } from "@/lib/logging";
import { pollPrivatbank } from "@/lib/external-apis/privatbank/poll";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await pollPrivatbank();
    logger.info({ event: "cron.privatbank_poll", ...result }, "cron poll complete");
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    logger.error({ event: "cron.privatbank_poll_error", error: message }, "cron poll failed");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

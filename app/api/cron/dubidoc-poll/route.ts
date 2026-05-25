import { NextResponse } from "next/server";

import { pollDubidocStatuses } from "@/lib/edo/poll-dubidoc";
import { logger } from "@/lib/logging";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await pollDubidocStatuses();
    logger.info({ event: "cron.dubidoc_poll", ...result }, "DubiDoc poll complete");
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    logger.error({ event: "cron.dubidoc_poll_error", error: message }, "DubiDoc poll failed");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

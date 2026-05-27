import { NextResponse } from "next/server";

import { shouldRunSync } from "@/lib/external-apis/moeosbb/schedule";
import { runMoeosbbSync } from "@/lib/external-apis/moeosbb/sync";
import { logger } from "@/lib/logging";
import { getPollingIntervals } from "@/lib/settings";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { moeosbbSchedule } = await getPollingIntervals();

  if (!shouldRunSync(moeosbbSchedule, new Date())) {
    logger.info({ event: "cron.moeosbb_skipped", schedule: moeosbbSchedule }, "schedule not met");
    return NextResponse.json({ skipped: true, schedule: moeosbbSchedule });
  }

  try {
    const result = await runMoeosbbSync();
    logger.info({ event: "cron.moeosbb_sync", ...result }, "cron sync complete");
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    logger.error({ event: "cron.moeosbb_sync_error", error: message }, "cron sync failed");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

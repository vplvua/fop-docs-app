"use server";

import type { PollResult } from "@/lib/edo/poll-dubidoc";
import { pollDubidocStatuses } from "@/lib/edo/poll-dubidoc";
import type { SyncResult } from "@/lib/external-apis/moeosbb/sync";
import { runMoeosbbSync } from "@/lib/external-apis/moeosbb/sync";

export async function triggerDubidocPollAction(): Promise<{
  ok: boolean;
  result?: PollResult;
  error?: string;
}> {
  try {
    const result = await pollDubidocStatuses();
    return { ok: true, result };
  } catch {
    return { ok: false, error: "Помилка опитування статусів Дубідок" };
  }
}

export async function triggerMoeosbbSyncAction(): Promise<{
  ok: boolean;
  result?: SyncResult;
  error?: string;
}> {
  try {
    const result = await runMoeosbbSync();
    return { ok: true, result };
  } catch {
    return { ok: false, error: "Помилка синхронізації з Моє ОСББ" };
  }
}

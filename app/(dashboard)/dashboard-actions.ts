"use server";

import type { PollResult } from "@/lib/edo/poll-dubidoc";
import { pollDubidocStatuses } from "@/lib/edo/poll-dubidoc";

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

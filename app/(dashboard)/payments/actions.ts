"use server";

import { pollPrivatbank } from "@/lib/external-apis/privatbank/poll";

export async function triggerPrivatbankPollNow(): Promise<{
  inserted: number;
  total: number;
  error?: string;
}> {
  try {
    return await pollPrivatbank();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { inserted: 0, total: 0, error: message };
  }
}

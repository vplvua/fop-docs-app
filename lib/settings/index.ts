import { eq, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { settings } from "@/lib/db/schema/settings";

export interface PatternEntry {
  pattern: string;
  description: string;
}

async function getValue<T>(key: string): Promise<T | null> {
  const [row] = await db
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, key))
    .limit(1);
  return (row?.value as T) ?? null;
}

export async function setSettingValue(key: string, value: unknown): Promise<void> {
  await db
    .insert(settings)
    .values({ key, value, updatedAt: sql`now()` })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value, updatedAt: sql`now()` },
    });
}

export async function getContractPatterns(): Promise<PatternEntry[]> {
  return (await getValue<PatternEntry[]>("contract_regex_patterns")) ?? [];
}

export async function getSmsKeywords(): Promise<string[]> {
  return (await getValue<string[]>("sms_keywords")) ?? [];
}

export async function getTransitEdrpouList(): Promise<string[]> {
  return (await getValue<string[]>("transit_edrpou_list")) ?? [];
}

export async function getPollingIntervals(): Promise<{
  privatbankMinutes: number;
  dubidocHours: number;
  moeosbbSchedule: string;
}> {
  const [pbMin, dubHrs, schedule] = await Promise.all([
    getValue<number>("privatbank_polling_interval_minutes"),
    getValue<number>("dubidoc_poll_interval_hours"),
    getValue<string>("moeosbb_sync_schedule"),
  ]);
  return {
    privatbankMinutes: pbMin ?? 60,
    dubidocHours: dubHrs ?? 6,
    moeosbbSchedule: schedule ?? "first",
  };
}

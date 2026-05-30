import { eq, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { settings } from "@/lib/db/schema/settings";

export interface PatternEntry {
  pattern: string;
  description: string;
}

export async function getSettingValue<T>(key: string): Promise<T | null> {
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
  return (await getSettingValue<PatternEntry[]>("contract_regex_patterns")) ?? [];
}

export async function getSmsKeywords(): Promise<string[]> {
  return (await getSettingValue<string[]>("sms_keywords")) ?? [];
}

export async function getTransitEdrpouList(): Promise<string[]> {
  return (await getSettingValue<string[]>("transit_edrpou_list")) ?? [];
}

/**
 * Number of monthly prices a one-shot yearly prepayment costs (the annual
 * discount). The annual price for any access tariff is `unit_price ×` this
 * value. Defaults to 10 ("pay 10 months, get 12") when unset — no seed, so
 * behaviour is unchanged until the admin configures it.
 */
export async function getAnnualPaidMonths(): Promise<number> {
  return (await getSettingValue<number>("annual_paid_months")) ?? 10;
}

export async function getPollingIntervals(): Promise<{
  privatbankMinutes: number;
  dubidocHours: number;
  moeosbbSchedule: string;
}> {
  const [pbMin, dubHrs, schedule] = await Promise.all([
    getSettingValue<number>("privatbank_polling_interval_minutes"),
    getSettingValue<number>("dubidoc_poll_interval_hours"),
    getSettingValue<string>("moeosbb_sync_schedule"),
  ]);
  return {
    privatbankMinutes: pbMin ?? 60,
    dubidocHours: dubHrs ?? 6,
    moeosbbSchedule: schedule ?? "daily",
  };
}

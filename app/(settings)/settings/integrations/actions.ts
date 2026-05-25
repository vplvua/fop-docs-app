"use server";

import { revalidatePath } from "next/cache";

import { logger } from "@/lib/logging";
import { setSettingValue } from "@/lib/settings";

import type { IntegrationActionState } from "./action-state";

function formStr(fd: FormData, key: string): string | undefined {
  const v = fd.get(key);
  if (typeof v !== "string" || v.trim() === "") return undefined;
  return v.trim();
}

export async function updateIntervals(
  _prev: IntegrationActionState,
  formData: FormData,
): Promise<IntegrationActionState> {
  const pbMin = Number(formStr(formData, "privatbankMinutes"));
  const dubHrs = Number(formStr(formData, "dubidocHours"));
  const schedule = formStr(formData, "moeosbbSchedule");

  if (Number.isNaN(pbMin) || pbMin < 1)
    return { status: "error", message: "Інтервал ПриватБанку має бути ≥ 1" };
  if (Number.isNaN(dubHrs) || dubHrs < 1)
    return { status: "error", message: "Інтервал Дубідок має бути ≥ 1" };
  if (!schedule || !["first", "last", "manual"].includes(schedule))
    return { status: "error", message: "Невірний розклад sync" };

  await Promise.all([
    setSettingValue("privatbank_polling_interval_minutes", pbMin),
    setSettingValue("dubidoc_poll_interval_hours", dubHrs),
    setSettingValue("moeosbb_sync_schedule", schedule),
  ]);

  logger.info(
    { event: "setting.intervals_updated", pbMin, dubHrs, schedule },
    "integration intervals updated",
  );
  revalidatePath("/settings/integrations");
  return { status: "success", message: "Збережено" };
}

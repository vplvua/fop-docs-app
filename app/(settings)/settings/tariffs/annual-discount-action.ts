"use server";

import { revalidatePath } from "next/cache";

import { logger } from "@/lib/logging";
import { setSettingValue } from "@/lib/settings";

import type { ServiceNameActionState } from "../service-name-state";

/**
 * Persist `annual_paid_months` — how many monthly prices a one-shot yearly
 * payment costs. The annual price for any access tariff is `unit_price ×` this.
 */
export async function updateAnnualPaidMonths(
  _prev: ServiceNameActionState,
  formData: FormData,
): Promise<ServiceNameActionState> {
  const raw = String(formData.get("annualPaidMonths") ?? "").trim();
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    return { status: "error", error: "Вкажіть ціле число більше 0" };
  }

  await setSettingValue("annual_paid_months", value);

  logger.info({ event: "setting.annual_paid_months_updated", value }, "annual paid months updated");
  revalidatePath("/settings/tariffs");
  return { status: "success", message: "Збережено" };
}

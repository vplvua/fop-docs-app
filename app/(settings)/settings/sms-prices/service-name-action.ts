"use server";

import { revalidatePath } from "next/cache";

import { logger } from "@/lib/logging";
import { getServiceNames, setServiceNames } from "@/lib/services";

import type { ServiceNameActionState } from "../service-name-state";

/** Edit only `service_names.sms`, merging over the current names (D4). */
export async function updateSmsServiceName(
  _prev: ServiceNameActionState,
  formData: FormData,
): Promise<ServiceNameActionState> {
  const sms = String(formData.get("serviceName") ?? "").trim();
  if (sms === "") {
    return { status: "error", error: "Обовʼязкове поле" };
  }

  const current = await getServiceNames();
  await setServiceNames({ ...current, sms });

  logger.info(
    { event: "setting.service_name_updated", serviceType: "sms" },
    "service name updated",
  );
  revalidatePath("/settings/sms-prices");
  return { status: "success", message: "Збережено" };
}

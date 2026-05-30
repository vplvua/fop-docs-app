"use server";

import { revalidatePath } from "next/cache";

import { logger } from "@/lib/logging";
import { getServiceNames, setServiceNames } from "@/lib/services";

import type { ServiceNameActionState } from "../service-name-state";

/** Edit only `service_names.access`, merging over the current names (D4). */
export async function updateAccessServiceName(
  _prev: ServiceNameActionState,
  formData: FormData,
): Promise<ServiceNameActionState> {
  const access = String(formData.get("serviceName") ?? "").trim();
  if (access === "") {
    return { status: "error", error: "Обовʼязкове поле" };
  }

  const current = await getServiceNames();
  await setServiceNames({ ...current, access });

  logger.info(
    { event: "setting.service_name_updated", serviceType: "access" },
    "service name updated",
  );
  revalidatePath("/settings/tariffs");
  return { status: "success", message: "Збережено" };
}

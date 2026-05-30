"use server";

import { revalidatePath } from "next/cache";

import { logger } from "@/lib/logging";
import { setFopRequisites } from "@/lib/requisites";
import { FOP_REQUISITES_FIELDS, fopRequisitesSchema } from "@/lib/requisites/schema";

import type { RequisitesActionState } from "./action-state";

export async function updateRequisites(
  _prev: RequisitesActionState,
  formData: FormData,
): Promise<RequisitesActionState> {
  const raw = Object.fromEntries(
    FOP_REQUISITES_FIELDS.map((field) => [field, String(formData.get(field) ?? "").trim()]),
  );

  const parsed = fopRequisitesSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "");
      if (key && !fieldErrors[key]) fieldErrors[key] = "Обовʼязкове поле";
    }
    return { status: "error", message: "Заповніть усі поля", fieldErrors };
  }

  await setFopRequisites(parsed.data);

  logger.info({ event: "setting.requisites_updated" }, "FOP requisites updated");
  revalidatePath("/settings/requisites");
  return { status: "success", message: "Збережено" };
}

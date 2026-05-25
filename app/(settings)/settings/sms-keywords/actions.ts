"use server";

import { revalidatePath } from "next/cache";

import { logger } from "@/lib/logging";
import { getSmsKeywords, setSettingValue } from "@/lib/settings";

import type { ListActionState } from "./action-state";

function formStr(fd: FormData, key: string): string | undefined {
  const v = fd.get(key);
  if (typeof v !== "string" || v.trim() === "") return undefined;
  return v.trim();
}

export async function addKeyword(
  _prev: ListActionState,
  formData: FormData,
): Promise<ListActionState> {
  const value = formStr(formData, "value");
  if (!value) return { status: "error", message: "Введіть ключове слово" };

  const current = await getSmsKeywords();
  if (current.includes(value)) return { status: "error", message: "Вже існує" };

  current.push(value);
  await setSettingValue("sms_keywords", current);

  logger.info({ event: "setting.sms_keyword_added", value }, "sms keyword added");
  revalidatePath("/settings/sms-keywords");
  return { status: "success", message: "Додано" };
}

export async function removeKeyword(
  _prev: ListActionState,
  formData: FormData,
): Promise<ListActionState> {
  const value = formStr(formData, "value");
  if (!value) return { status: "error", message: "Невірне значення" };

  const current = await getSmsKeywords();
  const filtered = current.filter((k) => k !== value);
  await setSettingValue("sms_keywords", filtered);

  logger.info({ event: "setting.sms_keyword_removed", value }, "sms keyword removed");
  revalidatePath("/settings/sms-keywords");
  return { status: "success", message: "Видалено" };
}

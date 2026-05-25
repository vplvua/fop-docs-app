"use server";

import { revalidatePath } from "next/cache";

import { logger } from "@/lib/logging";
import { getTransitEdrpouList, setSettingValue } from "@/lib/settings";

import type { ListActionState } from "./action-state";

function formStr(fd: FormData, key: string): string | undefined {
  const v = fd.get(key);
  if (typeof v !== "string" || v.trim() === "") return undefined;
  return v.trim();
}

export async function addEdrpou(
  _prev: ListActionState,
  formData: FormData,
): Promise<ListActionState> {
  const value = formStr(formData, "value");
  if (!value) return { status: "error", message: "Введіть ЄДРПОУ" };
  if (!/^\d{8}$/u.test(value)) return { status: "error", message: "ЄДРПОУ має бути 8 цифр" };

  const current = await getTransitEdrpouList();
  if (current.includes(value)) return { status: "error", message: "Вже існує" };

  current.push(value);
  await setSettingValue("transit_edrpou_list", current);

  logger.info({ event: "setting.transit_edrpou_added", value }, "transit edrpou added");
  revalidatePath("/settings/transit-edrpou");
  return { status: "success", message: "Додано" };
}

export async function removeEdrpou(
  _prev: ListActionState,
  formData: FormData,
): Promise<ListActionState> {
  const value = formStr(formData, "value");
  if (!value) return { status: "error", message: "Невірне значення" };

  const current = await getTransitEdrpouList();
  const filtered = current.filter((e) => e !== value);
  await setSettingValue("transit_edrpou_list", filtered);

  logger.info({ event: "setting.transit_edrpou_removed", value }, "transit edrpou removed");
  revalidatePath("/settings/transit-edrpou");
  return { status: "success", message: "Видалено" };
}

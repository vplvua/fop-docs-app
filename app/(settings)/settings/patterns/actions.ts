"use server";

import { revalidatePath } from "next/cache";

import { logger } from "@/lib/logging";
import { getContractPatterns, setSettingValue } from "@/lib/settings";

import type { PatternActionState } from "./action-state";

function formStr(fd: FormData, key: string): string | undefined {
  const v = fd.get(key);
  if (typeof v !== "string" || v.trim() === "") return undefined;
  return v.trim();
}

export async function addPattern(
  _prev: PatternActionState,
  formData: FormData,
): Promise<PatternActionState> {
  const pattern = formStr(formData, "pattern");
  if (!pattern) return { status: "error", message: "Введіть regex" };

  try {
    RegExp(pattern, "u");
  } catch {
    return { status: "error", message: "Невалідний regex" };
  }

  const description = formStr(formData, "description") ?? "";
  const current = await getContractPatterns();
  current.push({ pattern, description });
  await setSettingValue("contract_regex_patterns", current);

  logger.info({ event: "setting.pattern_added", pattern }, "contract pattern added");
  revalidatePath("/settings/patterns");
  return { status: "success", message: "Патерн додано" };
}

export async function removePattern(
  _prev: PatternActionState,
  formData: FormData,
): Promise<PatternActionState> {
  const index = Number(formStr(formData, "index"));
  if (Number.isNaN(index)) return { status: "error", message: "Невірний індекс" };

  const current = await getContractPatterns();
  if (index < 0 || index >= current.length) return { status: "error", message: "Невірний індекс" };

  current.splice(index, 1);
  await setSettingValue("contract_regex_patterns", current);

  logger.info({ event: "setting.pattern_removed", index }, "contract pattern removed");
  revalidatePath("/settings/patterns");
  return { status: "success", message: "Патерн видалено" };
}

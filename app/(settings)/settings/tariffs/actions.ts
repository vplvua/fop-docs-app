"use server";

import { eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { tariffs } from "@/lib/db/schema/tariffs";
import { logger } from "@/lib/logging";
import { createTariffSchema } from "@/lib/validation/tariffs";

import type { TariffActionState } from "./action-state";

function extractFieldErrors(issues: { path: PropertyKey[]; message: string }[]) {
  const fieldErrors: Record<string, string> = {};
  for (const issue of issues) {
    const key = String(issue.path[0]);
    if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return fieldErrors;
}

function formStr(fd: FormData, key: string): string | undefined {
  const v = fd.get(key);
  if (typeof v !== "string" || v.trim() === "") return undefined;
  return v.trim();
}

export async function createTariff(
  _prev: TariffActionState,
  formData: FormData,
): Promise<TariffActionState> {
  const raw = {
    apartmentsMin: formStr(formData, "apartmentsMin"),
    apartmentsMax: formStr(formData, "apartmentsMax"),
    price: formStr(formData, "price"),
    effectiveFrom: formStr(formData, "effectiveFrom"),
  };

  const parsed = createTariffSchema.safeParse(raw);
  if (!parsed.success) {
    return { status: "field_error", fieldErrors: extractFieldErrors(parsed.error.issues) };
  }

  const [row] = await db
    .insert(tariffs)
    .values({
      apartmentsMin: parsed.data.apartmentsMin ?? 0,
      apartmentsMax: parsed.data.apartmentsMax ?? null,
      price: parsed.data.price,
      effectiveFrom: parsed.data.effectiveFrom,
    })
    .returning({ id: tariffs.id });

  logger.info({ event: "tariff.created", tariffId: row?.id }, "tariff created");
  revalidatePath("/settings/tariffs");
  return { status: "success", message: "Тариф додано" };
}

export async function deleteTariff(
  _prev: TariffActionState,
  formData: FormData,
): Promise<TariffActionState> {
  const id = formStr(formData, "id");
  if (!id) return { status: "error", message: "Невірний ID" };

  const [target] = await db
    .select({ id: tariffs.id, apartmentsMax: tariffs.apartmentsMax })
    .from(tariffs)
    .where(eq(tariffs.id, id))
    .limit(1);

  if (!target) return { status: "error", message: "Тариф не знайдено" };

  if (target.apartmentsMax === null) {
    const catchAlls = await db
      .select({ id: tariffs.id })
      .from(tariffs)
      .where(isNull(tariffs.apartmentsMax));
    if (catchAlls.length <= 1) {
      return { status: "error", message: "Не можна видалити останнє базове правило" };
    }
  }

  await db.delete(tariffs).where(eq(tariffs.id, id));
  logger.info({ event: "tariff.deleted", tariffId: id }, "tariff deleted");
  revalidatePath("/settings/tariffs");
  return { status: "success", message: "Тариф видалено" };
}

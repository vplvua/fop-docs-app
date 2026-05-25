"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { smsPrices } from "@/lib/db/schema/tariffs";
import { logger } from "@/lib/logging";
import { createSmsPriceSchema } from "@/lib/validation/tariffs";

import type { SmsPriceActionState } from "./action-state";

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

export async function createSmsPrice(
  _prev: SmsPriceActionState,
  formData: FormData,
): Promise<SmsPriceActionState> {
  const raw = {
    price: formStr(formData, "price"),
    effectiveFrom: formStr(formData, "effectiveFrom"),
  };

  const parsed = createSmsPriceSchema.safeParse(raw);
  if (!parsed.success) {
    return { status: "field_error", fieldErrors: extractFieldErrors(parsed.error.issues) };
  }

  const [row] = await db
    .insert(smsPrices)
    .values({
      price: parsed.data.price,
      effectiveFrom: parsed.data.effectiveFrom,
    })
    .returning({ id: smsPrices.id });

  logger.info({ event: "sms_price.created", smsPriceId: row?.id }, "sms price created");
  revalidatePath("/settings/sms-prices");
  return { status: "success", message: "Ціну СМС додано" };
}

export async function deleteSmsPrice(
  _prev: SmsPriceActionState,
  formData: FormData,
): Promise<SmsPriceActionState> {
  const id = formStr(formData, "id");
  if (!id) return { status: "error", message: "Невірний ID" };

  await db.delete(smsPrices).where(eq(smsPrices.id, id));
  logger.info({ event: "sms_price.deleted", smsPriceId: id }, "sms price deleted");
  revalidatePath("/settings/sms-prices");
  return { status: "success", message: "Ціну видалено" };
}

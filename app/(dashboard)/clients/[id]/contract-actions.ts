"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { contracts } from "@/lib/db/schema/contracts";
import { logger } from "@/lib/logging";
import { createContractSchema, updateContractSchema } from "@/lib/validation/contracts";

import type { ClientActionState } from "../action-state";

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

export async function createContract(
  _prev: ClientActionState,
  formData: FormData,
): Promise<ClientActionState> {
  const raw = {
    clientId: formStr(formData, "clientId"),
    number: formStr(formData, "number"),
    signedDate: formStr(formData, "signedDate"),
    isStandard: formStr(formData, "isStandard"),
    fileUrl: formStr(formData, "fileUrl"),
    notes: formStr(formData, "notes"),
  };

  const parsed = createContractSchema.safeParse(raw);
  if (!parsed.success) {
    return { status: "field_error", fieldErrors: extractFieldErrors(parsed.error.issues) };
  }

  const existing = await db
    .select({ id: contracts.id })
    .from(contracts)
    .where(eq(contracts.clientId, parsed.data.clientId))
    .limit(1);

  if (existing.length > 0) {
    return { status: "error", message: "Клієнт вже має договір" };
  }

  const [row] = await db
    .insert(contracts)
    .values({
      clientId: parsed.data.clientId,
      number: parsed.data.number,
      signedDate: parsed.data.signedDate,
      isStandard: parsed.data.isStandard ?? true,
      fileUrl: parsed.data.fileUrl || null,
      notes: parsed.data.notes || null,
    })
    .returning({ id: contracts.id });

  logger.info(
    { event: "contract.created", contractId: row?.id, clientId: parsed.data.clientId },
    "contract created",
  );
  revalidatePath(`/clients/${parsed.data.clientId}`);
  return { status: "success", message: "Договір створено" };
}

export async function updateContract(
  _prev: ClientActionState,
  formData: FormData,
): Promise<ClientActionState> {
  const id = formStr(formData, "id");
  if (!id) return { status: "error", message: "Невірний ID" };

  const raw: Record<string, string | undefined> = { id };
  for (const key of ["number", "signedDate", "isStandard", "fileUrl", "notes"]) {
    raw[key] = formStr(formData, key) ?? (formData.has(key) ? "" : undefined);
  }

  const parsed = updateContractSchema.safeParse(raw);
  if (!parsed.success) {
    return { status: "field_error", fieldErrors: extractFieldErrors(parsed.error.issues) };
  }

  const { id: contractId, ...fields } = parsed.data;

  const setValues: Record<string, unknown> = { updatedAt: sql`now()` };
  if (fields.number !== undefined) setValues.number = fields.number;
  if (fields.signedDate !== undefined) setValues.signedDate = fields.signedDate;
  if (fields.isStandard !== undefined) setValues.isStandard = fields.isStandard;
  if (fields.fileUrl !== undefined) setValues.fileUrl = fields.fileUrl || null;
  if (fields.notes !== undefined) setValues.notes = fields.notes || null;

  await db.update(contracts).set(setValues).where(eq(contracts.id, contractId));

  const [updated] = await db
    .select({ clientId: contracts.clientId })
    .from(contracts)
    .where(eq(contracts.id, contractId))
    .limit(1);

  logger.info({ event: "contract.updated", contractId }, "contract updated");
  if (updated) revalidatePath(`/clients/${updated.clientId}`);
  return { status: "success", message: "Збережено" };
}

export async function deleteContract(
  _prev: ClientActionState,
  formData: FormData,
): Promise<ClientActionState> {
  const id = formStr(formData, "id");
  if (!id) return { status: "error", message: "Невірний ID" };

  const [contract] = await db
    .select({ id: contracts.id, clientId: contracts.clientId })
    .from(contracts)
    .where(eq(contracts.id, id))
    .limit(1);

  if (!contract) {
    return { status: "error", message: "Договір не знайдено" };
  }

  try {
    await db.delete(contracts).where(eq(contracts.id, id));
  } catch (err: unknown) {
    const pgCode = (err as { code?: string }).code;
    if (pgCode === "23503") {
      return { status: "error", message: "Неможливо видалити договір з прив'язаними актами" };
    }
    throw err;
  }

  logger.info(
    { event: "contract.deleted", contractId: id, clientId: contract.clientId },
    "contract deleted",
  );
  revalidatePath(`/clients/${contract.clientId}`);
  return { status: "success", message: "Договір видалено" };
}

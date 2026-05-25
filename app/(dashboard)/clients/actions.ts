"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { clients } from "@/lib/db/schema/clients";
import { logger } from "@/lib/logging";
import { createClientSchema, updateClientSchema } from "@/lib/validation/clients";

import type { ClientActionState } from "./action-state";

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

export async function createClient(
  _prev: ClientActionState,
  formData: FormData,
): Promise<ClientActionState> {
  const raw = {
    name: formStr(formData, "name"),
    legalId: formStr(formData, "legalId"),
    email: formStr(formData, "email"),
    address: formStr(formData, "address"),
    bankName: formStr(formData, "bankName"),
    bankAccount: formStr(formData, "bankAccount"),
    apartmentsCount: formStr(formData, "apartmentsCount"),
    accessPriceOverride: formStr(formData, "accessPriceOverride"),
    edoProvider: formStr(formData, "edoProvider"),
    moeosbbUserId: formStr(formData, "moeosbbUserId"),
  };
  const parsed = createClientSchema.safeParse(raw);
  if (!parsed.success) {
    return { status: "field_error", fieldErrors: extractFieldErrors(parsed.error.issues) };
  }

  if (parsed.data.moeosbbUserId) {
    const existing = await db
      .select({ id: clients.id })
      .from(clients)
      .where(eq(clients.moeosbbUserId, parsed.data.moeosbbUserId))
      .limit(1);
    if (existing.length > 0) {
      return {
        status: "field_error",
        fieldErrors: { moeosbbUserId: "Цей ID вже прив'язано до іншого клієнта" },
      };
    }
  }

  const [row] = await db
    .insert(clients)
    .values({
      name: parsed.data.name,
      legalId: parsed.data.legalId,
      email: parsed.data.email,
      address: parsed.data.address ?? "",
      bankName: parsed.data.bankName ?? null,
      bankAccount: parsed.data.bankAccount ?? null,
      apartmentsCount: parsed.data.apartmentsCount ?? null,
      accessPriceOverride: parsed.data.accessPriceOverride ?? null,
      edoProvider: parsed.data.edoProvider ?? "dubidoc",
      moeosbbUserId: parsed.data.moeosbbUserId ?? null,
    })
    .returning({ id: clients.id });

  logger.info({ event: "client.created", clientId: row?.id }, "client created");
  revalidatePath("/clients");
  redirect(`/clients/${row?.id}`);
}

export async function updateClient(
  _prev: ClientActionState,
  formData: FormData,
): Promise<ClientActionState> {
  const id = formStr(formData, "id");
  if (!id) return { status: "error", message: "Невірний ID" };

  const raw: Record<string, string | undefined> = { id };
  for (const key of [
    "name",
    "legalId",
    "email",
    "address",
    "bankName",
    "bankAccount",
    "apartmentsCount",
    "accessPriceOverride",
    "edoProvider",
    "moeosbbUserId",
    "autoActDisabled",
  ]) {
    raw[key] = formStr(formData, key) ?? (formData.has(key) ? "" : undefined);
  }

  const parsed = updateClientSchema.safeParse(raw);
  if (!parsed.success) {
    return { status: "field_error", fieldErrors: extractFieldErrors(parsed.error.issues) };
  }

  const { id: clientId, ...fields } = parsed.data;
  if (fields.moeosbbUserId) {
    const existing = await db
      .select({ id: clients.id })
      .from(clients)
      .where(eq(clients.moeosbbUserId, fields.moeosbbUserId))
      .limit(1);
    if (existing.length > 0 && existing[0]?.id !== clientId) {
      return {
        status: "field_error",
        fieldErrors: { moeosbbUserId: "Цей ID вже прив'язано до іншого клієнта" },
      };
    }
  }

  const setValues: Record<string, unknown> = { updatedAt: sql`now()` };
  if (fields.name !== undefined) setValues.name = fields.name;
  if (fields.legalId !== undefined) setValues.legalId = fields.legalId;
  if (fields.email !== undefined) setValues.email = fields.email;
  if (fields.address !== undefined) setValues.address = fields.address;
  if (fields.bankName !== undefined) setValues.bankName = fields.bankName || null;
  if (fields.bankAccount !== undefined) setValues.bankAccount = fields.bankAccount || null;
  if (fields.apartmentsCount !== undefined) setValues.apartmentsCount = fields.apartmentsCount;
  if (fields.accessPriceOverride !== undefined)
    setValues.accessPriceOverride = fields.accessPriceOverride || null;
  if (fields.edoProvider !== undefined) setValues.edoProvider = fields.edoProvider;
  if (fields.moeosbbUserId !== undefined) setValues.moeosbbUserId = fields.moeosbbUserId || null;
  if (fields.autoActDisabled !== undefined) setValues.autoActDisabled = fields.autoActDisabled;

  await db.update(clients).set(setValues).where(eq(clients.id, clientId));
  logger.info({ event: "client.updated", clientId }, "client updated");
  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/clients");
  return { status: "success", message: "Збережено" };
}

export async function archiveClientAction(formData: FormData): Promise<void> {
  const id = formData.get("id") as string;
  await db
    .update(clients)
    .set({ autoActDisabled: true, updatedAt: sql`now()` })
    .where(eq(clients.id, id));
  logger.info({ event: "client.archived", clientId: id }, "client archived");
  revalidatePath("/clients");
  redirect("/clients");
}

export async function activateClientAction(formData: FormData): Promise<void> {
  const id = formData.get("id") as string;
  await db
    .update(clients)
    .set({ autoActDisabled: false, updatedAt: sql`now()` })
    .where(eq(clients.id, id));
  logger.info({ event: "client.activated", clientId: id }, "client activated");
  revalidatePath(`/clients/${id}`);
  revalidatePath("/clients");
  redirect(`/clients/${id}`);
}

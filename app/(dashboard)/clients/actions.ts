"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { clients } from "@/lib/db/schema/clients";
import { logger } from "@/lib/logging";
import {
  CLIENT_CARD_FIELDS,
  type ClientCardField,
  type ClientUpdateInput,
  clientUpdateSchema,
  createClientSchema,
} from "@/lib/validation/clients";

import type { ClientActionState } from "./action-state";

/** Partial update payload sent by the client card: id + only the dirty fields. */
export type ClientUpdatePayload = { id: string } & Partial<Record<ClientCardField, string>>;

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
    shortName: formStr(formData, "shortName"),
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
      shortName: parsed.data.shortName ?? null,
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

/** Maps validated, present fields to a Drizzle SET object (empty → NULL where nullable). */
function buildClientSetValues(fields: Omit<ClientUpdateInput, "id">): Record<string, unknown> {
  const set: Record<string, unknown> = { updatedAt: sql`now()` };
  if (fields.name !== undefined) set.name = fields.name;
  if (fields.shortName !== undefined) set.shortName = fields.shortName || null;
  if (fields.legalId !== undefined) set.legalId = fields.legalId;
  if (fields.email !== undefined) set.email = fields.email;
  if (fields.address !== undefined) set.address = fields.address;
  if (fields.bankName !== undefined) set.bankName = fields.bankName || null;
  if (fields.bankAccount !== undefined) set.bankAccount = fields.bankAccount || null;
  if (fields.apartmentsCount !== undefined) set.apartmentsCount = fields.apartmentsCount;
  if (fields.accessPriceOverride !== undefined)
    set.accessPriceOverride = fields.accessPriceOverride || null;
  if (fields.edoProvider !== undefined) set.edoProvider = fields.edoProvider;
  if (fields.moeosbbUserId !== undefined) set.moeosbbUserId = fields.moeosbbUserId || null;
  if (fields.autoActDisabled !== undefined) set.autoActDisabled = fields.autoActDisabled;
  return set;
}

/**
 * Partial client-card update. The payload carries only the dirty fields, so a
 * field the operator did not touch is absent and left untouched — an empty
 * required field (email/legal_id) never blocks the save. Non-empty values are
 * format-validated; completeness is surfaced by the act-readiness indicator.
 */
export async function updateClient(payload: ClientUpdatePayload): Promise<ClientActionState> {
  const id = typeof payload.id === "string" ? payload.id.trim() : "";
  if (!id) return { status: "error", message: "Невірний ID" };

  const raw: Record<string, unknown> = { id };
  for (const key of CLIENT_CARD_FIELDS) {
    if (key in payload) raw[key] = payload[key] ?? "";
  }

  const parsed = clientUpdateSchema.safeParse(raw);
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

  await db.update(clients).set(buildClientSetValues(fields)).where(eq(clients.id, clientId));
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

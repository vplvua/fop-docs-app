"use server";

import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { clients } from "@/lib/db/schema/clients";
import { runMoeosbbSync } from "@/lib/external-apis/moeosbb/sync";

export async function syncSingleClientAction(
  clientId: string,
): Promise<{ ok: boolean; error?: string }> {
  const [client] = await db
    .select({ moeosbbUserId: clients.moeosbbUserId })
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);

  if (!client) return { ok: false, error: "Клієнта не знайдено" };
  if (!client.moeosbbUserId) return { ok: false, error: "Клієнт не пов'язаний з Моє ОСББ" };

  try {
    await runMoeosbbSync(client.moeosbbUserId);
    return { ok: true };
  } catch {
    return { ok: false, error: "Помилка синхронізації з Моє ОСББ" };
  }
}

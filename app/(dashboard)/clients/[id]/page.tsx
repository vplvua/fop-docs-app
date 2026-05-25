import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";

import { db } from "@/lib/db";
import { clients } from "@/lib/db/schema/clients";
import { contracts } from "@/lib/db/schema/contracts";

import { ClientCard } from "./client-card";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [client] = await db
    .select({ name: clients.name })
    .from(clients)
    .where(eq(clients.id, id))
    .limit(1);
  return { title: client ? `${client.name} · ФОП Документи` : "Клієнт · ФОП Документи" };
}

export default async function ClientPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { tab } = await searchParams;
  const [client] = await db.select().from(clients).where(eq(clients.id, id)).limit(1);
  if (!client) notFound();
  const [contract] = await db.select().from(contracts).where(eq(contracts.clientId, id)).limit(1);
  return <ClientCard client={client} contract={contract ?? null} activeTab={tab ?? "info"} />;
}

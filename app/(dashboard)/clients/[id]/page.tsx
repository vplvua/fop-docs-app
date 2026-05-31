import { and, desc, eq, gte, lte } from "drizzle-orm";
import { notFound } from "next/navigation";

import { db } from "@/lib/db";
import { acts } from "@/lib/db/schema/acts";
import { clients } from "@/lib/db/schema/clients";
import { contracts } from "@/lib/db/schema/contracts";
import { payments } from "@/lib/db/schema/payments";
import { resolveDateRange } from "@/lib/data-tables/date-ranges";

import { PageContainer } from "@/app/components/page-container";

import { ClientCard } from "./client-card";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    tab?: string;
    // Per-tab date filters (independent): `p_*` scopes the Платежі tab on
    // `payment_date`, `a_*` scopes the Акти tab on `act_date`.
    p_period?: string;
    p_from?: string;
    p_to?: string;
    a_period?: string;
    a_from?: string;
    a_to?: string;
  }>;
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
  const sp = await searchParams;
  const { tab } = sp;
  const [client] = await db.select().from(clients).where(eq(clients.id, id)).limit(1);
  if (!client) notFound();
  const [contract] = await db.select().from(contracts).where(eq(contracts.clientId, id)).limit(1);

  const now = new Date();
  const paymentsRange = resolveDateRange(
    { period: sp.p_period, from: sp.p_from, to: sp.p_to },
    now,
  );
  const actsRange = resolveDateRange({ period: sp.a_period, from: sp.a_from, to: sp.a_to }, now);

  const paymentsConditions = [eq(payments.clientId, id)];
  if (paymentsRange.from) paymentsConditions.push(gte(payments.paymentDate, paymentsRange.from));
  if (paymentsRange.to) paymentsConditions.push(lte(payments.paymentDate, paymentsRange.to));

  const actsConditions = [eq(acts.clientId, id)];
  if (actsRange.from) actsConditions.push(gte(acts.actDate, actsRange.from));
  if (actsRange.to) actsConditions.push(lte(acts.actDate, actsRange.to));

  const [clientPayments, clientActs] = await Promise.all([
    db
      .select()
      .from(payments)
      .where(and(...paymentsConditions))
      .orderBy(desc(payments.paymentDate)),
    db
      .select()
      .from(acts)
      .where(and(...actsConditions))
      .orderBy(desc(acts.actDate)),
  ]);
  return (
    <PageContainer>
      <ClientCard
        client={client}
        contract={contract ?? null}
        payments={clientPayments}
        acts={clientActs}
        activeTab={tab ?? "info"}
      />
    </PageContainer>
  );
}

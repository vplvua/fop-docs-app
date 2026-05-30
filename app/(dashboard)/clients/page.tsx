import { and, eq, ilike, isNotNull, isNull, sql } from "drizzle-orm";
import Link from "next/link";

import { db } from "@/lib/db";
import { clients } from "@/lib/db/schema/clients";

import { ClientsTable } from "./clients-table";
import { ClientsToolbar } from "./clients-toolbar";

interface Props {
  searchParams: Promise<{
    q?: string;
    status?: string;
    source?: string;
    edo?: string;
  }>;
}

export const metadata = { title: "Клієнти · ФОП Документи" };

export default async function ClientsPage({ searchParams }: Props) {
  const params = await searchParams;
  const isArchive = params.status === "archive";
  const conditions = [eq(clients.autoActDisabled, isArchive)];

  if (params.source === "moeosbb") conditions.push(isNotNull(clients.moeosbbUserId));
  if (params.source === "local") conditions.push(isNull(clients.moeosbbUserId));

  if (params.edo === "dubidoc") conditions.push(eq(clients.edoProvider, "dubidoc"));
  if (params.edo === "vchasno_external")
    conditions.push(eq(clients.edoProvider, "vchasno_external"));

  if (params.q) {
    const q = params.q;
    conditions.push(sql`(${ilike(clients.name, `%${q}%`)} OR ${ilike(clients.legalId, `${q}%`)})`);
  }

  const rows = await db
    .select()
    .from(clients)
    .where(and(...conditions))
    .orderBy(clients.name);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-heading-2 text-foreground">Клієнти</h1>
        <Link
          href="/clients/new"
          className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          + Новий клієнт
        </Link>
      </div>
      <ClientsToolbar params={params} />
      <ClientsTable rows={rows} />
    </div>
  );
}

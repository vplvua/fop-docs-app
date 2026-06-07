import { and, asc, count, eq, ilike, isNotNull, isNull, or, sql } from "drizzle-orm";
import Link from "next/link";

import { DataTablePage, Pagination } from "@/app/components/data-table";
import { db } from "@/lib/db";
import { clients } from "@/lib/db/schema/clients";
import { contracts } from "@/lib/db/schema/contracts";
import { clampPage, offsetFor, parseTableQuery } from "@/lib/data-tables/parse-table-query";
import { clientsTableQuery } from "@/lib/data-tables/configs";

import { ClientsTable } from "./clients-table";
import { ClientsToolbar } from "./clients-toolbar";

// Allow-listed sort key → column. Mirrors `clientsTableQuery.sortable`.
const SORT_COLUMNS = {
  name: clients.name,
  legalId: clients.legalId,
  apartmentsCount: clients.apartmentsCount,
  moeosbbUserId: clients.moeosbbUserId,
  createdAt: clients.createdAt,
} as const;

interface Props {
  searchParams: Promise<{
    q?: string;
    status?: string;
    source?: string;
    edo?: string;
    page?: string;
    perPage?: string;
    sort?: string;
    dir?: string;
  }>;
}

export const metadata = { title: "Клієнти · ФОП Документи" };

export default async function ClientsPage({ searchParams }: Props) {
  const params = await searchParams;
  const query = parseTableQuery(params, clientsTableQuery);
  const isArchive = params.status === "archive";
  const conditions = [eq(clients.autoActDisabled, isArchive)];

  if (params.source === "moeosbb") conditions.push(isNotNull(clients.moeosbbUserId));
  if (params.source === "local") conditions.push(isNull(clients.moeosbbUserId));

  if (params.edo === "dubidoc") conditions.push(eq(clients.edoProvider, "dubidoc"));
  if (params.edo === "vchasno_external")
    conditions.push(eq(clients.edoProvider, "vchasno_external"));

  if (params.q) {
    const q = params.q;
    const branches = [
      ilike(clients.name, `%${q}%`),
      ilike(clients.shortName, `%${q}%`),
      ilike(clients.legalId, `${q}%`),
    ];
    // All-digit query also matches a MoeOSBB id by substring (cast to text), so
    // partial ids behave like the name search.
    if (/^\d+$/u.test(q))
      branches.push(sql`cast(${clients.moeosbbUserId} as text) like ${`%${q}%`}`);
    const search = or(...branches);
    if (search) conditions.push(search);
  }

  const where = and(...conditions);

  const totalRows = await db.select({ value: count() }).from(clients).where(where);
  const totalCount = totalRows[0]?.value ?? 0;
  const page = clampPage(query.page, query.perPage, totalCount);

  const sortColumn = SORT_COLUMNS[query.sort as keyof typeof SORT_COLUMNS] ?? clients.moeosbbUserId;
  const direction = query.dir === "asc" ? sql`asc` : sql`desc`;
  // NULLS LAST keeps local-only clients (no MoeOSBB id) at the bottom and is a
  // no-op for the non-nullable columns; `id` is a stable pagination tiebreaker.
  const orderArgs = [sql`${sortColumn} ${direction} nulls last`, asc(clients.id)];

  const rows = await db
    .select()
    .from(clients)
    .leftJoin(contracts, eq(contracts.clientId, clients.id))
    .where(where)
    .orderBy(...orderArgs)
    .limit(query.perPage)
    .offset(offsetFor(page, query.perPage));

  return (
    <DataTablePage
      header={
        <>
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
        </>
      }
      footer={
        <>
          <Pagination page={page} perPage={query.perPage} totalCount={totalCount} />
        </>
      }
    >
      <ClientsTable rows={rows} sort={query.sort} dir={query.dir} />
    </DataTablePage>
  );
}

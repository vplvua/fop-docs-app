import { and, asc, count, desc, eq, ilike } from "drizzle-orm";
import Link from "next/link";

import {
  DataTable,
  DataTableBody,
  DataTableEmpty,
  DataTableHead,
  DataTablePage,
  Pagination,
  RowLink,
  SortableHeader,
  Td,
  Th,
} from "@/app/components/data-table";
import { db } from "@/lib/db";
import { acts } from "@/lib/db/schema/acts";
import type { ClientSnapshot } from "@/lib/classification/types";
import {
  clampPage,
  offsetFor,
  parseTableQuery,
  type SortDir,
} from "@/lib/data-tables/parse-table-query";
import { actsTableQuery } from "@/lib/data-tables/configs";

export const metadata = { title: "Акти · ФОП Документи" };

export const ACTS_COLUMNS = ["Дата", "Номер", "Клієнт", "Послуга", "Сума", "ЕДО", "Статус"];

// Allow-listed sort key → column. Mirrors `actsTableQuery.sortable`.
const SORT_COLUMNS = {
  actDate: acts.actDate,
  number: acts.number,
  amount: acts.amount,
  serviceType: acts.serviceType,
} as const;

const STATUS_LABELS: Record<string, string> = {
  draft: "Чернетка",
  sent_to_edo: "Відправлено в ЕДО",
  signed: "Підписано",
  deleted: "Видалено",
};

// Soft-tag treatment (tinted bg + deep text) per DESIGN.md badge-tag-* and D-DS-03.
const STATUS_BADGES: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  sent_to_edo: "bg-warning/12 text-warning-deep",
  signed: "bg-success/12 text-success-deep",
  deleted: "bg-destructive/12 text-destructive-deep",
};

const EDO_LABELS: Record<string, string> = {
  dubidoc: "Дубідок",
  vchasno_external: "Вчасно",
};

interface Props {
  searchParams: Promise<{
    status?: string;
    q?: string;
    service_type?: string;
    edo?: string;
    page?: string;
    perPage?: string;
    sort?: string;
    dir?: string;
  }>;
}

export default async function ActsPage({ searchParams }: Props) {
  const params = await searchParams;
  const query = parseTableQuery(params, actsTableQuery);
  const conditions = [];

  if (params.status) {
    conditions.push(eq(acts.status, params.status as (typeof acts.status.enumValues)[number]));
  }
  if (params.service_type) {
    conditions.push(eq(acts.serviceType, params.service_type));
  }
  if (params.edo) {
    conditions.push(eq(acts.edoProvider, params.edo as "dubidoc" | "vchasno_external"));
  }
  if (params.q) {
    conditions.push(ilike(acts.serviceDescription, `%${params.q}%`));
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const totalRows = await db.select({ value: count() }).from(acts).where(where);
  const totalCount = totalRows[0]?.value ?? 0;
  const page = clampPage(query.page, query.perPage, totalCount);

  const sortColumn = SORT_COLUMNS[query.sort as keyof typeof SORT_COLUMNS] ?? acts.actDate;
  const primary = query.dir === "asc" ? asc(sortColumn) : desc(sortColumn);
  // Default sort is `act_date DESC, number`; add `number` as a secondary key
  // when sorting by date, then `id` as a stable tiebreaker for pagination.
  const orderArgs =
    query.sort === "actDate" ? [primary, asc(acts.number), asc(acts.id)] : [primary, asc(acts.id)];

  const rows = await db
    .select()
    .from(acts)
    .where(where)
    .orderBy(...orderArgs)
    .limit(query.perPage)
    .offset(offsetFor(page, query.perPage));

  return (
    <DataTablePage
      header={
        <>
          <div className="flex items-center justify-between">
            <h1 className="text-heading-2 text-foreground">Акти</h1>
            <Link
              href="/acts/new"
              className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              Створити вручну
            </Link>
          </div>
          <ActsToolbar params={params} />
        </>
      }
      footer={
        <>
          <Pagination page={page} perPage={query.perPage} totalCount={totalCount} />
        </>
      }
    >
      <ActsTable rows={rows} sort={query.sort} dir={query.dir} />
    </DataTablePage>
  );
}

function ActsToolbar({ params }: { params: Record<string, string | undefined> }) {
  const statuses = ["draft", "sent_to_edo", "signed", "deleted"] as const;
  return (
    <div className="flex flex-wrap items-center gap-3">
      <form action="/acts" method="get" className="flex items-center gap-2">
        <input
          name="q"
          type="search"
          defaultValue={params.q ?? ""}
          placeholder="Пошук"
          aria-label="Пошук актів"
          className="block h-9 w-48 rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </form>
      <div className="flex gap-1">
        <Link
          href="/acts"
          className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${!params.status ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:text-foreground"}`}
        >
          Усі
        </Link>
        {statuses.map((s) => (
          <Link
            key={s}
            href={`/acts?status=${s}`}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${params.status === s ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:text-foreground"}`}
          >
            {STATUS_LABELS[s]}
          </Link>
        ))}
      </div>
    </div>
  );
}

function ActsTable({
  rows,
  sort,
  dir,
}: {
  rows: (typeof acts.$inferSelect)[];
  sort: string;
  dir: SortDir;
}) {
  if (rows.length === 0) {
    return <DataTableEmpty>Немає актів</DataTableEmpty>;
  }

  return (
    <DataTable>
      <DataTableHead>
        <tr>
          <Th>
            <SortableHeader
              label="Дата"
              sortKey="actDate"
              currentSort={sort}
              currentDir={dir}
              defaultDir="desc"
            />
          </Th>
          <Th>
            <SortableHeader label="Номер" sortKey="number" currentSort={sort} currentDir={dir} />
          </Th>
          <Th>Клієнт</Th>
          <Th>
            <SortableHeader
              label="Послуга"
              sortKey="serviceType"
              currentSort={sort}
              currentDir={dir}
            />
          </Th>
          <Th>
            <SortableHeader
              label="Сума"
              sortKey="amount"
              currentSort={sort}
              currentDir={dir}
              defaultDir="desc"
            />
          </Th>
          <Th>ЕДО</Th>
          <Th>Статус</Th>
        </tr>
      </DataTableHead>
      <DataTableBody>
        {rows.map((a) => (
          <ActRow key={a.id} act={a} />
        ))}
      </DataTableBody>
    </DataTable>
  );
}

function ActRow({ act }: { act: typeof acts.$inferSelect }) {
  const client = act.clientSnapshot as ClientSnapshot;
  const total = Number(act.amount).toFixed(2);

  return (
    <RowLink href={`/acts/${act.id}`} label={`Акт ${act.number}`}>
      <Td>{act.actDate}</Td>
      <Td>{act.number}</Td>
      <Td className="max-w-xs truncate" title={client.name}>
        {client.name}
      </Td>
      <Td>{act.serviceType}</Td>
      <Td>{total} грн</Td>
      <Td>{EDO_LABELS[act.edoProvider] ?? act.edoProvider}</Td>
      <Td>
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGES[act.status] ?? "bg-muted text-muted-foreground"}`}
        >
          {STATUS_LABELS[act.status] ?? act.status}
        </span>
      </Td>
    </RowLink>
  );
}

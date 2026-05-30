import { and, asc, count, desc, eq, ilike, or } from "drizzle-orm";
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
import { payments } from "@/lib/db/schema/payments";
import {
  clampPage,
  offsetFor,
  parseTableQuery,
  type SortDir,
} from "@/lib/data-tables/parse-table-query";
import { paymentsTableQuery } from "@/lib/data-tables/configs";

export const metadata = { title: "Платежі · ФОП Документи" };

export const PAYMENTS_COLUMNS = ["Дата", "Сума", "Призначення", "Платник", "Статус"];

// Allow-listed sort key → column. Mirrors `paymentsTableQuery.sortable`.
const SORT_COLUMNS = {
  paymentDate: payments.paymentDate,
  amount: payments.amount,
  payerName: payments.payerName,
} as const;

const STATUS_LABELS: Record<string, string> = {
  received: "Отримано",
  classified: "Класифіковано",
  awaiting_review: "На апрув",
  in_queue: "У черзі",
  skipped: "Пропущено",
};

// Soft-tag treatment (tinted bg + deep text) per DESIGN.md badge-tag-* and D-DS-03.
const STATUS_BADGES: Record<string, string> = {
  received: "bg-muted text-muted-foreground",
  classified: "bg-success/12 text-success-deep",
  awaiting_review: "bg-warning/12 text-warning-deep",
  in_queue: "bg-primary/12 text-primary",
  skipped: "bg-muted text-muted-foreground",
};

interface Props {
  searchParams: Promise<{
    status?: string;
    q?: string;
    page?: string;
    perPage?: string;
    sort?: string;
    dir?: string;
  }>;
}

export default async function PaymentsPage({ searchParams }: Props) {
  const params = await searchParams;
  const { status, q } = params;
  const query = parseTableQuery(params, paymentsTableQuery);

  const conditions = [];
  if (status)
    conditions.push(eq(payments.status, status as (typeof payments.status.enumValues)[number]));
  if (q) {
    conditions.push(or(ilike(payments.purpose, `%${q}%`), ilike(payments.payerName, `%${q}%`)));
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const totalRows = await db.select({ value: count() }).from(payments).where(where);
  const totalCount = totalRows[0]?.value ?? 0;
  const page = clampPage(query.page, query.perPage, totalCount);

  const sortColumn = SORT_COLUMNS[query.sort as keyof typeof SORT_COLUMNS] ?? payments.paymentDate;
  const orderBy = query.dir === "asc" ? asc(sortColumn) : desc(sortColumn);

  const rows = await db
    .select()
    .from(payments)
    .where(where)
    .orderBy(orderBy, asc(payments.id))
    .limit(query.perPage)
    .offset(offsetFor(page, query.perPage));

  return (
    <DataTablePage
      header={
        <>
          <div className="flex items-center justify-between">
            <h1 className="text-heading-2 text-foreground">Платежі</h1>
            <Link
              href="/payments/import"
              className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              Завантажити за датою
            </Link>
          </div>
          <PaymentsToolbar currentStatus={status} currentSearch={q} />
        </>
      }
      footer={
        <>
          <Pagination page={page} perPage={query.perPage} totalCount={totalCount} />
        </>
      }
    >
      <PaymentsTable rows={rows} sort={query.sort} dir={query.dir} />
    </DataTablePage>
  );
}

function PaymentsToolbar({
  currentStatus,
  currentSearch,
}: {
  currentStatus?: string | undefined;
  currentSearch?: string | undefined;
}) {
  const statuses = ["received", "classified", "awaiting_review", "in_queue", "skipped"] as const;
  return (
    <div className="flex flex-wrap items-center gap-3">
      <form action="/payments" method="get" className="flex items-center gap-2">
        <input
          name="q"
          type="search"
          defaultValue={currentSearch ?? ""}
          placeholder="Пошук за призначенням"
          aria-label="Пошук платежів"
          className="block h-9 w-64 rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </form>
      <div className="flex gap-1">
        <Link
          href="/payments"
          className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${!currentStatus ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:text-foreground"}`}
        >
          Усі
        </Link>
        {statuses.map((s) => (
          <Link
            key={s}
            href={`/payments?status=${s}`}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${currentStatus === s ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:text-foreground"}`}
          >
            {STATUS_LABELS[s]}
          </Link>
        ))}
      </div>
    </div>
  );
}

function PaymentsTable({
  rows,
  sort,
  dir,
}: {
  rows: (typeof payments.$inferSelect)[];
  sort: string;
  dir: SortDir;
}) {
  if (rows.length === 0) {
    return <DataTableEmpty>Немає платежів</DataTableEmpty>;
  }

  return (
    <DataTable>
      <DataTableHead>
        <tr>
          <Th>
            <SortableHeader
              label="Дата"
              sortKey="paymentDate"
              currentSort={sort}
              currentDir={dir}
              defaultDir="desc"
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
          <Th>Призначення</Th>
          <Th>
            <SortableHeader
              label="Платник"
              sortKey="payerName"
              currentSort={sort}
              currentDir={dir}
            />
          </Th>
          <Th>Статус</Th>
        </tr>
      </DataTableHead>
      <DataTableBody>
        {rows.map((p) => (
          <RowLink key={p.id} href={`/payments/${p.id}`} label={`Платіж ${p.paymentDate}`}>
            <Td>{p.paymentDate}</Td>
            <Td>{p.amount}</Td>
            <Td className="max-w-xs truncate" title={p.purpose}>
              {p.purpose}
            </Td>
            <Td>{p.payerName}</Td>
            <Td>
              <span
                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGES[p.status] ?? "bg-muted text-muted-foreground"}`}
              >
                {STATUS_LABELS[p.status] ?? p.status}
              </span>
            </Td>
          </RowLink>
        ))}
      </DataTableBody>
    </DataTable>
  );
}

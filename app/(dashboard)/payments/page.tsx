import { and, asc, count, desc, eq, getTableColumns, gte, ilike, lte, or, sql } from "drizzle-orm";
import Link from "next/link";

import {
  ActiveFilters,
  DataTable,
  DataTableBody,
  DataTableEmpty,
  DataTableHead,
  DataTablePage,
  DateRangeFilter,
  Pagination,
  ResetFilters,
  RowLink,
  SearchInput,
  SortableHeader,
  Td,
  Th,
  type FilterChip,
} from "@/app/components/data-table";
import { db } from "@/lib/db";
import { clients } from "@/lib/db/schema/clients";
import { payments } from "@/lib/db/schema/payments";
import {
  clampPage,
  offsetFor,
  parseTableQuery,
  type SortDir,
} from "@/lib/data-tables/parse-table-query";
import { paymentsTableQuery } from "@/lib/data-tables/configs";
import { resolveDateRange } from "@/lib/data-tables/date-ranges";
import { formatAmount } from "@/lib/data-tables/format-amount";

import { buildFilterHref } from "../build-filter-href";
import { dateRangeChip } from "../date-range-chip";

export const metadata = { title: "Платежі · ФОП Документи" };

export const PAYMENTS_COLUMNS = ["Дата", "Сума, ₴", "Призначення", "Платник", "MoeOSBB", "Статус"];

// Payment row + the linked client's MoeOSBB id (null when unlinked).
type PaymentRow = typeof payments.$inferSelect & { moeosbbUserId: number | null };

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

const RESET_KEYS = ["q", "status", "period", "from", "to"] as const;

interface Props {
  searchParams: Promise<{
    status?: string;
    q?: string;
    period?: string;
    from?: string;
    to?: string;
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
    const branches = [ilike(payments.payerName, `%${q}%`), ilike(payments.purpose, `%${q}%`)];
    // All-digit query also matches the linked client's MoeOSBB id by substring
    // (cast to text). Only linked payments (client_id set during classification)
    // surface this way.
    if (/^\d+$/u.test(q))
      branches.push(sql`cast(${clients.moeosbbUserId} as text) like ${`%${q}%`}`);
    conditions.push(or(...branches));
  }
  const range = resolveDateRange(params, new Date());
  if (range.from) conditions.push(gte(payments.paymentDate, range.from));
  if (range.to) conditions.push(lte(payments.paymentDate, range.to));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const totalRows = await db
    .select({ value: count() })
    .from(payments)
    .leftJoin(clients, eq(payments.clientId, clients.id))
    .where(where);
  const totalCount = totalRows[0]?.value ?? 0;
  const page = clampPage(query.page, query.perPage, totalCount);

  const sortColumn = SORT_COLUMNS[query.sort as keyof typeof SORT_COLUMNS] ?? payments.paymentDate;
  const orderBy = query.dir === "asc" ? asc(sortColumn) : desc(sortColumn);

  const rows = await db
    .select({ ...getTableColumns(payments), moeosbbUserId: clients.moeosbbUserId })
    .from(payments)
    .leftJoin(clients, eq(payments.clientId, clients.id))
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
          <PaymentsToolbar params={params} />
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

const STATUS_ORDER = ["received", "classified", "awaiting_review", "in_queue", "skipped"] as const;

function activeChips(params: {
  status?: string | undefined;
  q?: string | undefined;
  period?: string | undefined;
  from?: string | undefined;
  to?: string | undefined;
}): FilterChip[] {
  const chips: FilterChip[] = [];
  if (params.q) chips.push({ keys: ["q"], label: `Пошук: «${params.q}»` });
  if (params.status && STATUS_LABELS[params.status])
    chips.push({ keys: ["status"], label: `Статус: ${STATUS_LABELS[params.status]}` });
  const dateChip = dateRangeChip(params);
  if (dateChip) chips.push(dateChip);
  return chips;
}

function PaymentsToolbar({ params }: { params: Record<string, string | undefined> }) {
  const currentStatus = params.status;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <SearchInput
          placeholder="Пошук за платником, призначенням або MoeOSBB id…"
          ariaLabel="Пошук платежів"
          className="w-72"
        />
        <DateRangeFilter />
        <ResetFilters keys={RESET_KEYS} />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1">
          <Link
            href={buildFilterHref(params, "/payments", "status", null)}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${!currentStatus ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:text-foreground"}`}
          >
            Усі
          </Link>
          {STATUS_ORDER.map((s) => (
            <Link
              key={s}
              href={buildFilterHref(params, "/payments", "status", s)}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${currentStatus === s ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:text-foreground"}`}
            >
              {STATUS_LABELS[s]}
            </Link>
          ))}
        </div>
      </div>
      <ActiveFilters chips={activeChips(params)} />
    </div>
  );
}

function PaymentsTable({ rows, sort, dir }: { rows: PaymentRow[]; sort: string; dir: SortDir }) {
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
              label="Сума, ₴"
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
          <Th>MoeOSBB</Th>
          <Th>Статус</Th>
        </tr>
      </DataTableHead>
      <DataTableBody>
        {rows.map((p) => (
          <RowLink
            key={p.id}
            href={`/payments/${p.id}`}
            label={`Платіж ${p.paymentDate}`}
            tooltip={`${p.payerName}\n${p.purpose}`}
          >
            <Td className="whitespace-nowrap">{p.paymentDate}</Td>
            <Td className="whitespace-nowrap tabular-nums">{formatAmount(p.amount)}</Td>
            <Td className="max-w-xs truncate">{p.purpose}</Td>
            <Td className="max-w-xs truncate">{p.payerName}</Td>
            <Td className="tabular-nums text-muted-foreground">{p.moeosbbUserId ?? "—"}</Td>
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

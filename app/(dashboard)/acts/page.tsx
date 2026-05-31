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
import { acts } from "@/lib/db/schema/acts";
import { clients } from "@/lib/db/schema/clients";
import type { ClientSnapshot } from "@/lib/classification/types";
import {
  clampPage,
  offsetFor,
  parseTableQuery,
  type SortDir,
} from "@/lib/data-tables/parse-table-query";
import { actsTableQuery } from "@/lib/data-tables/configs";
import { resolveDateRange } from "@/lib/data-tables/date-ranges";
import { formatAmount } from "@/lib/data-tables/format-amount";

import { buildFilterHref } from "../build-filter-href";
import { dateRangeChip } from "../date-range-chip";

export const metadata = { title: "Акти · ФОП Документи" };

export const ACTS_COLUMNS = [
  "Дата",
  "Номер",
  "Клієнт",
  "MoeOSBB",
  "Послуга",
  "Сума, ₴",
  "ЕДО",
  "Статус",
];

// Act row + the linked client's MoeOSBB id (null when the client has none).
type ActWithMoeosbb = typeof acts.$inferSelect & { moeosbbUserId: number | null };

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

const SERVICE_TYPE_LABELS: Record<string, string> = {
  sms: "SMS",
  access: "Доступ",
};

const RESET_KEYS = ["q", "status", "service_type", "period", "from", "to"] as const;

interface Props {
  searchParams: Promise<{
    status?: string;
    q?: string;
    service_type?: string;
    edo?: string;
    period?: string;
    from?: string;
    to?: string;
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
    const q = params.q;
    // Search the current client via join (name + MoeOSBB-id substring),
    // replacing the prior `service_description` search.
    const branches = [ilike(clients.name, `%${q}%`)];
    // All-digit query also matches the client's MoeOSBB id by substring (cast to
    // text), so partial ids behave like the name search.
    if (/^\d+$/u.test(q))
      branches.push(sql`cast(${clients.moeosbbUserId} as text) like ${`%${q}%`}`);
    conditions.push(or(...branches));
  }
  const range = resolveDateRange(params, new Date());
  if (range.from) conditions.push(gte(acts.actDate, range.from));
  if (range.to) conditions.push(lte(acts.actDate, range.to));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const totalRows = await db
    .select({ value: count() })
    .from(acts)
    .leftJoin(clients, eq(acts.clientId, clients.id))
    .where(where);
  const totalCount = totalRows[0]?.value ?? 0;
  const page = clampPage(query.page, query.perPage, totalCount);

  const sortColumn = SORT_COLUMNS[query.sort as keyof typeof SORT_COLUMNS] ?? acts.actDate;
  const primary = query.dir === "asc" ? asc(sortColumn) : desc(sortColumn);
  // Default sort is `act_date DESC, number`; add `number` as a secondary key
  // when sorting by date, then `id` as a stable tiebreaker for pagination.
  const orderArgs =
    query.sort === "actDate" ? [primary, asc(acts.number), asc(acts.id)] : [primary, asc(acts.id)];

  const rows = await db
    .select({ ...getTableColumns(acts), moeosbbUserId: clients.moeosbbUserId })
    .from(acts)
    .leftJoin(clients, eq(acts.clientId, clients.id))
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

const STATUS_ORDER = ["draft", "sent_to_edo", "signed", "deleted"] as const;
const SERVICE_TYPE_ORDER = ["sms", "access"] as const;

function activeChips(params: {
  status?: string | undefined;
  service_type?: string | undefined;
  q?: string | undefined;
  period?: string | undefined;
  from?: string | undefined;
  to?: string | undefined;
}): FilterChip[] {
  const chips: FilterChip[] = [];
  if (params.q) chips.push({ keys: ["q"], label: `Пошук: «${params.q}»` });
  if (params.status && STATUS_LABELS[params.status])
    chips.push({ keys: ["status"], label: `Статус: ${STATUS_LABELS[params.status]}` });
  if (params.service_type && SERVICE_TYPE_LABELS[params.service_type])
    chips.push({
      keys: ["service_type"],
      label: `Послуга: ${SERVICE_TYPE_LABELS[params.service_type]}`,
    });
  const dateChip = dateRangeChip(params);
  if (dateChip) chips.push(dateChip);
  return chips;
}

function ActsToolbar({ params }: { params: Record<string, string | undefined> }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <SearchInput
          placeholder="Пошук за клієнтом або MoeOSBB id…"
          ariaLabel="Пошук актів"
          className="w-72"
        />
        <DateRangeFilter />
        <ResetFilters keys={RESET_KEYS} />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1">
          <Link
            href={buildFilterHref(params, "/acts", "status", null)}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${!params.status ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:text-foreground"}`}
          >
            Усі
          </Link>
          {STATUS_ORDER.map((s) => (
            <Link
              key={s}
              href={buildFilterHref(params, "/acts", "status", s)}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${params.status === s ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:text-foreground"}`}
            >
              {STATUS_LABELS[s]}
            </Link>
          ))}
        </div>
        <ServiceTypeFilters params={params} />
      </div>
      <ActiveFilters chips={activeChips(params)} />
    </div>
  );
}

function ServiceTypeFilters({ params }: { params: Record<string, string | undefined> }) {
  const active = params.service_type;
  return (
    <div className="flex gap-1">
      <Link
        href={buildFilterHref(params, "/acts", "service_type", null)}
        className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${!active ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:text-foreground"}`}
      >
        Усі послуги
      </Link>
      {SERVICE_TYPE_ORDER.map((s) => (
        <Link
          key={s}
          href={buildFilterHref(params, "/acts", "service_type", s)}
          className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${active === s ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:text-foreground"}`}
        >
          {SERVICE_TYPE_LABELS[s]}
        </Link>
      ))}
    </div>
  );
}

function ActsTable({ rows, sort, dir }: { rows: ActWithMoeosbb[]; sort: string; dir: SortDir }) {
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
          <Th>MoeOSBB</Th>
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
              label="Сума, ₴"
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

function ActRow({ act }: { act: ActWithMoeosbb }) {
  const client = act.clientSnapshot as ClientSnapshot;

  return (
    <RowLink href={`/acts/${act.id}`} label={`Акт ${act.number}`} tooltip={client.name}>
      <Td className="whitespace-nowrap">{act.actDate}</Td>
      <Td className="whitespace-nowrap">{act.number}</Td>
      <Td className="max-w-xs truncate">{client.name}</Td>
      <Td className="tabular-nums text-muted-foreground">{act.moeosbbUserId ?? "—"}</Td>
      <Td>{SERVICE_TYPE_LABELS[act.serviceType] ?? act.serviceType}</Td>
      <Td className="tabular-nums">{formatAmount(act.amount)}</Td>
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

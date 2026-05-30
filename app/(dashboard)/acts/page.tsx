import { desc, eq, ilike, and } from "drizzle-orm";
import Link from "next/link";

import { db } from "@/lib/db";
import { acts } from "@/lib/db/schema/acts";
import type { ClientSnapshot } from "@/lib/classification/types";

export const metadata = { title: "Акти · ФОП Документи" };

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
  searchParams: Promise<{ status?: string; q?: string; service_type?: string; edo?: string }>;
}

export default async function ActsPage({ searchParams }: Props) {
  const params = await searchParams;
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

  const rows = await db
    .select()
    .from(acts)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(acts.actDate))
    .limit(500);

  return (
    <div className="space-y-6">
      <h1 className="text-heading-2 text-foreground">Акти</h1>
      <ActsToolbar params={params} />
      <ActsTable rows={rows} />
    </div>
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

function ActsTable({ rows }: { rows: (typeof acts.$inferSelect)[] }) {
  if (rows.length === 0) {
    return <p className="py-12 text-center text-sm text-muted-foreground">Немає актів</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Дата</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Номер</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Клієнт</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Послуга</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Сума</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">ЕДО</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Статус</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => (
            <ActRow key={a.id} act={a} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ActRow({ act }: { act: typeof acts.$inferSelect }) {
  const client = act.clientSnapshot as ClientSnapshot;
  const total = (Number(act.unitPrice) * Number(act.quantity)).toFixed(2);

  return (
    <tr className="border-b border-border last:border-0">
      <td className="px-4 py-3">
        <Link href={`/acts/${act.id}`} className="hover:underline">
          {act.actDate}
        </Link>
      </td>
      <td className="px-4 py-3">{act.number}</td>
      <td className="max-w-xs truncate px-4 py-3" title={client.name}>
        {client.name}
      </td>
      <td className="px-4 py-3">{act.serviceType}</td>
      <td className="px-4 py-3">{total} грн</td>
      <td className="px-4 py-3">{EDO_LABELS[act.edoProvider] ?? act.edoProvider}</td>
      <td className="px-4 py-3">
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGES[act.status] ?? "bg-muted text-muted-foreground"}`}
        >
          {STATUS_LABELS[act.status] ?? act.status}
        </span>
      </td>
    </tr>
  );
}

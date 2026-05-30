import { desc, eq, ilike, or, and } from "drizzle-orm";
import Link from "next/link";

import { db } from "@/lib/db";
import { payments } from "@/lib/db/schema/payments";

export const metadata = { title: "Платежі · ФОП Документи" };

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
  searchParams: Promise<{ status?: string; q?: string }>;
}

export default async function PaymentsPage({ searchParams }: Props) {
  const { status, q } = await searchParams;

  const conditions = [];
  if (status)
    conditions.push(eq(payments.status, status as (typeof payments.status.enumValues)[number]));
  if (q) {
    conditions.push(or(ilike(payments.purpose, `%${q}%`), ilike(payments.payerName, `%${q}%`)));
  }

  const rows = await db
    .select()
    .from(payments)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(payments.paymentDate))
    .limit(500);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-heading-2 text-foreground">Платежі</h1>
      </div>
      <PaymentsToolbar currentStatus={status} currentSearch={q} />
      <PaymentsTable rows={rows} />
    </div>
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

function PaymentsTable({ rows }: { rows: (typeof payments.$inferSelect)[] }) {
  if (rows.length === 0) {
    return <p className="py-12 text-center text-sm text-muted-foreground">Немає платежів</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Дата</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Сума</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Призначення</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Платник</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Статус</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id} className="border-b border-border last:border-0">
              <td className="px-4 py-3">
                <Link href={`/payments/${p.id}`} className="hover:underline">
                  {p.paymentDate}
                </Link>
              </td>
              <td className="px-4 py-3">{p.amount}</td>
              <td className="max-w-xs truncate px-4 py-3" title={p.purpose}>
                {p.purpose}
              </td>
              <td className="px-4 py-3">{p.payerName}</td>
              <td className="px-4 py-3">
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGES[p.status] ?? "bg-muted text-muted-foreground"}`}
                >
                  {STATUS_LABELS[p.status] ?? p.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

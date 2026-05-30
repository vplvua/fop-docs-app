import Link from "next/link";

import type { acts } from "@/lib/db/schema/acts";
import type { payments } from "@/lib/db/schema/payments";

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  received: "Отримано",
  classified: "Класифіковано",
  awaiting_review: "На апрув",
  in_queue: "У черзі",
  skipped: "Пропущено",
};

const ACT_STATUS_LABELS: Record<string, string> = {
  draft: "Чернетка",
  sent_to_edo: "Відправлено в ЕДО",
  signed: "Підписано",
  deleted: "Видалено",
};

export function ClientPaymentsTab({ rows }: { rows: (typeof payments.$inferSelect)[] }) {
  if (rows.length === 0) {
    return <p className="py-12 text-center text-sm text-muted-foreground">Платежів немає</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Дата</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Сума</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Призначення</th>
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
              <td className="px-4 py-3">
                <span className="inline-flex rounded-full border border-border px-2 py-0.5 text-xs font-medium">
                  {PAYMENT_STATUS_LABELS[p.status] ?? p.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ClientActsTab({ rows }: { rows: (typeof acts.$inferSelect)[] }) {
  if (rows.length === 0) {
    return <p className="py-12 text-center text-sm text-muted-foreground">Актів немає</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Номер</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Дата</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Сума</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Статус</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => (
            <tr key={a.id} className="border-b border-border last:border-0">
              <td className="px-4 py-3">
                <Link href={`/acts/${a.id}`} className="hover:underline">
                  {a.number}
                </Link>
              </td>
              <td className="px-4 py-3">{a.actDate}</td>
              <td className="px-4 py-3">{Number(a.amount).toFixed(2)} грн</td>
              <td className="px-4 py-3">
                <span className="inline-flex rounded-full border border-border px-2 py-0.5 text-xs font-medium">
                  {ACT_STATUS_LABELS[a.status] ?? a.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

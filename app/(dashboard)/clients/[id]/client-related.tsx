import { DateRangeFilter, ResetFilters, RowLink } from "@/app/components/data-table";
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
  waiting_for_client_sign: "Очікує підпису клієнта",
  signed: "Підписано",
  deleted: "Видалено",
};

// Per-tab date-filter param keys (kept module-level so the reset button receives
// a stable array reference).
const PAYMENTS_FILTER_KEYS = ["p_period", "p_from", "p_to"] as const;
const ACTS_FILTER_KEYS = ["a_period", "a_from", "a_to"] as const;

export function ClientPaymentsTab({ rows }: { rows: (typeof payments.$inferSelect)[] }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <DateRangeFilter periodKey="p_period" fromKey="p_from" toKey="p_to" />
        <ResetFilters keys={PAYMENTS_FILTER_KEYS} scoped />
      </div>
      {rows.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Платежів немає</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Дата</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Сума</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Призначення
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Статус</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <RowLink
                  key={p.id}
                  href={`/payments/${p.id}`}
                  label={`Платіж від ${p.paymentDate}`}
                  className="border-b border-border last:border-0"
                >
                  <td className="px-4 py-3">{p.paymentDate}</td>
                  <td className="px-4 py-3">{p.amount}</td>
                  <td className="max-w-xs truncate px-4 py-3" title={p.purpose}>
                    {p.purpose}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded-full border border-border px-2 py-0.5 text-xs font-medium">
                      {PAYMENT_STATUS_LABELS[p.status] ?? p.status}
                    </span>
                  </td>
                </RowLink>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function ClientActsTab({ rows }: { rows: (typeof acts.$inferSelect)[] }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <DateRangeFilter periodKey="a_period" fromKey="a_from" toKey="a_to" />
        <ResetFilters keys={ACTS_FILTER_KEYS} scoped />
      </div>
      {rows.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Актів немає</p>
      ) : (
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
                <RowLink
                  key={a.id}
                  href={`/acts/${a.id}`}
                  label={`Акт ${a.number}`}
                  className="border-b border-border last:border-0"
                >
                  <td className="px-4 py-3">{a.number}</td>
                  <td className="px-4 py-3">{a.actDate}</td>
                  <td className="px-4 py-3">{Number(a.amount).toFixed(2)} грн</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded-full border border-border px-2 py-0.5 text-xs font-medium">
                      {ACT_STATUS_LABELS[a.status] ?? a.status}
                    </span>
                  </td>
                </RowLink>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

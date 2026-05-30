"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";

import {
  fetchStatementByDateAction,
  importStatementTransactionAction,
  type StatementRow,
} from "./actions";

const STATUS_LABELS: Record<string, string> = {
  received: "Отримано",
  classified: "Класифіковано",
  awaiting_review: "На апрув",
  in_queue: "У черзі",
  skipped: "Пропущено",
};

const INPUT_CLASS =
  "h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring";

export function StatementImport() {
  const router = useRouter();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [rows, setRows] = useState<StatementRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fetching, startFetch] = useTransition();
  const [importingId, setImportingId] = useState<string | null>(null);

  const handleStartChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setStartDate(e.target.value),
    [],
  );
  const handleEndChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setEndDate(e.target.value),
    [],
  );

  const handleFetch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!startDate) return;
      setError(null);
      setRows(null);
      startFetch(async () => {
        const res = await fetchStatementByDateAction(startDate, endDate || undefined);
        if (res.error) setError(res.error);
        else setRows(res.rows ?? []);
      });
    },
    [startDate, endDate],
  );

  const handleImport = useCallback(
    async (row: StatementRow) => {
      setImportingId(row.bankTransactionId);
      setError(null);
      const res = await importStatementTransactionAction(
        row.bankTransactionId,
        startDate,
        endDate || undefined,
      );
      setImportingId(null);
      if (res.error) setError(res.error);
      else if (res.paymentId) router.push(`/payments/${res.paymentId}`);
    },
    [router, startDate, endDate],
  );

  return (
    <div className="space-y-5">
      <form onSubmit={handleFetch} className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Дата (від)</span>
          <input
            type="date"
            required
            aria-label="Дата від"
            value={startDate}
            onChange={handleStartChange}
            className={INPUT_CLASS}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Дата (до) — необовʼязково</span>
          <input
            type="date"
            aria-label="Дата до"
            value={endDate}
            min={startDate || undefined}
            onChange={handleEndChange}
            className={INPUT_CLASS}
          />
        </label>
        <button
          type="submit"
          disabled={fetching || !startDate}
          className="h-9 rounded-lg border border-border bg-foreground px-4 text-sm font-medium text-background transition-colors hover:opacity-90 disabled:opacity-50"
        >
          {fetching ? "Завантаження…" : "Завантажити виписку"}
        </button>
      </form>

      {error ? (
        <p className="rounded-md bg-destructive/12 px-3 py-2 text-sm text-destructive">{error}</p>
      ) : null}

      {rows ? (
        <StatementTable rows={rows} importingId={importingId} onImport={handleImport} />
      ) : null}
    </div>
  );
}

function StatementTable({
  rows,
  importingId,
  onImport,
}: {
  rows: StatementRow[];
  importingId: string | null;
  onImport: (row: StatementRow) => void;
}) {
  if (rows.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        За обрану дату підтверджених транзакцій не знайдено
      </p>
    );
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
            <th className="px-4 py-3 text-right font-medium text-muted-foreground">Дія</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <StatementRowItem
              key={r.bankTransactionId}
              row={r}
              importing={importingId === r.bankTransactionId}
              disabled={importingId !== null}
              onImport={onImport}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatementRowItem({
  row,
  importing,
  disabled,
  onImport,
}: {
  row: StatementRow;
  importing: boolean;
  disabled: boolean;
  onImport: (row: StatementRow) => void;
}) {
  const handleClick = useCallback(() => onImport(row), [onImport, row]);

  return (
    <tr className="border-b border-border last:border-0">
      <td className="px-4 py-3">{row.paymentDate}</td>
      <td className="px-4 py-3">{row.amount}</td>
      <td className="max-w-xs truncate px-4 py-3" title={row.purpose}>
        {row.purpose}
      </td>
      <td className="px-4 py-3">{row.payerName}</td>
      <td className="px-4 py-3 text-right">
        {row.status === "already_imported" ? (
          <AlreadyImported row={row} />
        ) : (
          <button
            type="button"
            disabled={disabled}
            onClick={handleClick}
            className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
          >
            {importing ? "Імпорт…" : "Імпортувати"}
          </button>
        )}
      </td>
    </tr>
  );
}

function AlreadyImported({ row }: { row: StatementRow }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
        Вже в системі
      </span>
      {row.existingPaymentId ? (
        <Link
          href={`/payments/${row.existingPaymentId}`}
          className="text-xs text-foreground hover:underline"
        >
          платіж
        </Link>
      ) : null}
      {row.actId ? (
        <Link href={`/acts/${row.actId}`} className="text-xs text-foreground hover:underline">
          акт
        </Link>
      ) : row.existingStatus ? (
        <span className="text-xs text-muted-foreground">
          {STATUS_LABELS[row.existingStatus] ?? row.existingStatus}
        </span>
      ) : null}
    </span>
  );
}

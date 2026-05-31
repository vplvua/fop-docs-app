"use client";

import { Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState, useTransition } from "react";

import {
  ClientCombobox,
  INPUT_CLASS,
  MONTHS,
  type ContractClient,
} from "../../../acts/new/manual-act-form";
import { splitLineHintAction, splitPaymentAction } from "./actions";

type ServiceType = "access" | "sms";

interface LineState {
  key: string;
  clientId: string;
  serviceType: ServiceType;
  periodYear: number;
  periodMonth: number;
  quantity: string;
  unitPrice: string;
  amount: string;
  amountTouched: boolean;
}

/** Integer kopiykas from a free-typed decimal (display/gating only; the server
 * re-checks exactly). */
function kopiykas(value: string): number {
  return Math.round(Number(value) * 100);
}

/** amount = unitPrice × quantity, or "" when either is not a positive number. */
function computeAmount(unitPrice: string, quantity: string): string {
  const p = Number(unitPrice);
  const q = Number(quantity);
  if (!Number.isFinite(p) || !Number.isFinite(q) || p <= 0 || q <= 0) return "";
  return (p * q).toFixed(2);
}

let lineCounter = 0;
function emptyLine(clientId: string): LineState {
  const now = new Date();
  lineCounter += 1;
  return {
    key: `line-${lineCounter}`,
    clientId,
    serviceType: "access",
    periodYear: now.getFullYear(),
    periodMonth: now.getMonth() + 1,
    quantity: "1",
    unitPrice: "",
    amount: "",
    amountTouched: false,
  };
}

function AllocationBar({ paymentAmount, allocated }: { paymentAmount: string; allocated: number }) {
  const target = kopiykas(paymentAmount);
  const remainder = target - allocated;
  const matched = remainder === 0;
  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border px-4 py-3 text-sm ${
        matched ? "border-primary/40 bg-primary/8 text-foreground" : "border-border bg-muted"
      }`}
    >
      <span>
        Розподілено <strong>{(allocated / 100).toFixed(2)}</strong> / {paymentAmount} грн
      </span>
      <span className={matched ? "text-primary" : "text-muted-foreground"}>
        Залишок: {(remainder / 100).toFixed(2)} грн {matched ? "✓" : ""}
      </span>
    </div>
  );
}

interface RowProps {
  index: number;
  line: LineState;
  clients: ContractClient[];
  canRemove: boolean;
  onPatch: (index: number, patch: Partial<LineState>) => void;
  onClient: (index: number, clientId: string) => void;
  onRemove: (index: number) => void;
}

/** Stable per-field change handlers for one line, bound to its index. Avoids
 * inline arrow props (react-perf/jsx-no-new-function-as-prop). */
function useLineHandlers(index: number, onPatch: RowProps["onPatch"]) {
  const patch = useCallback((p: Partial<LineState>) => onPatch(index, p), [onPatch, index]);
  return {
    service: useCallback(
      (e: React.ChangeEvent<HTMLSelectElement>) =>
        patch({ serviceType: e.target.value as ServiceType }),
      [patch],
    ),
    month: useCallback(
      (e: React.ChangeEvent<HTMLSelectElement>) => patch({ periodMonth: Number(e.target.value) }),
      [patch],
    ),
    year: useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => patch({ periodYear: Number(e.target.value) }),
      [patch],
    ),
    quantity: useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => patch({ quantity: e.target.value }),
      [patch],
    ),
    unitPrice: useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => patch({ unitPrice: e.target.value }),
      [patch],
    ),
    amount: useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) =>
        patch({ amount: e.target.value, amountTouched: true }),
      [patch],
    ),
  };
}

function SplitLineFields({
  line,
  on,
}: {
  line: LineState;
  on: ReturnType<typeof useLineHandlers>;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted-foreground">Послуга</span>
        <select
          aria-label="Послуга"
          value={line.serviceType}
          onChange={on.service}
          className={INPUT_CLASS}
        >
          <option value="access">Доступ до сервісу</option>
          <option value="sms">SMS-розсилка</option>
        </select>
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Місяць</span>
          <select
            aria-label="Місяць періоду"
            value={line.periodMonth}
            onChange={on.month}
            className={INPUT_CLASS}
          >
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Рік</span>
          <input
            aria-label="Рік періоду"
            type="number"
            min={2000}
            max={2100}
            value={line.periodYear}
            onChange={on.year}
            className={INPUT_CLASS}
          />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted-foreground">Кількість</span>
        <input
          aria-label="Кількість"
          type="text"
          inputMode="decimal"
          value={line.quantity}
          onChange={on.quantity}
          className={INPUT_CLASS}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted-foreground">Ціна за одиницю</span>
        <input
          aria-label="Ціна за одиницю"
          type="text"
          inputMode="decimal"
          value={line.unitPrice}
          onChange={on.unitPrice}
          placeholder="за тарифом"
          className={INPUT_CLASS}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm sm:col-span-2">
        <span className="text-muted-foreground">Сума</span>
        <input
          aria-label="Сума"
          type="text"
          inputMode="decimal"
          value={line.amount}
          onChange={on.amount}
          className={INPUT_CLASS}
        />
      </label>
    </div>
  );
}

function SplitLineRow({ index, line, clients, canRemove, onPatch, onClient, onRemove }: RowProps) {
  const on = useLineHandlers(index, onPatch);
  const setClient = useCallback((id: string) => onClient(index, id), [onClient, index]);
  const remove = useCallback(() => onRemove(index), [onRemove, index]);

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">Акт {index + 1}</span>
        {canRemove ? (
          <button
            type="button"
            aria-label="Видалити рядок"
            onClick={remove}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        ) : null}
      </div>
      <ClientCombobox
        clients={clients}
        value={line.clientId}
        onChange={setClient}
        disabled={false}
      />
      <SplitLineFields line={line} on={on} />
    </div>
  );
}

/** Patch a line, auto-recomputing amount from price × quantity until touched. */
function patchLine(line: LineState, patch: Partial<LineState>): LineState {
  const next = { ...line, ...patch };
  if (!next.amountTouched && ("unitPrice" in patch || "quantity" in patch)) {
    const computed = computeAmount(next.unitPrice, next.quantity);
    if (computed) next.amount = computed;
  }
  return next;
}

const HINT_FIELDS = ["serviceType", "periodYear", "periodMonth"] as const;

export function SplitForm({
  paymentId,
  paymentAmount,
  clients,
}: {
  paymentId: string;
  paymentAmount: string;
  clients: ContractClient[];
}) {
  const router = useRouter();
  const firstClient = clients[0]?.id ?? "";
  const [lines, setLines] = useState<LineState[]>(() => [
    emptyLine(firstClient),
    emptyLine(firstClient),
  ]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startSubmit] = useTransition();

  const allocated = useMemo(
    () => lines.reduce((sum, l) => sum + (l.amount ? kopiykas(l.amount) : 0), 0),
    [lines],
  );
  const matched = allocated === kopiykas(paymentAmount);
  const allValid = lines.every(
    (l) =>
      l.clientId && kopiykas(l.amount) > 0 && Number(l.quantity) > 0 && Number(l.unitPrice) > 0,
  );

  // Pull the tariff hint for one line and patch its price/quantity/amount.
  const applyHint = useCallback(async (index: number, l: LineState) => {
    try {
      const hint = await splitLineHintAction(
        l.clientId,
        l.serviceType,
        l.periodYear,
        l.periodMonth,
      );
      setLines((prev) =>
        prev.map((cur, i) => {
          if (i !== index) return cur;
          const unitPrice = hint.unitPrice ?? cur.unitPrice;
          const quantity =
            cur.quantity && cur.quantity !== "0" ? cur.quantity : hint.defaultQuantity;
          const amount = cur.amountTouched ? cur.amount : computeAmount(unitPrice, quantity);
          return { ...cur, unitPrice, quantity, amount };
        }),
      );
    } catch {
      // hint is best-effort
    }
  }, []);

  const onPatch = useCallback(
    (index: number, patch: Partial<LineState>) => {
      setLines((prev) => prev.map((cur, i) => (i === index ? patchLine(cur, patch) : cur)));
      if (HINT_FIELDS.some((f) => f in patch)) {
        setLines((prev) => {
          const target = prev[index];
          if (target) void applyHint(index, target);
          return prev;
        });
      }
    },
    [applyHint],
  );

  const onClient = useCallback(
    (index: number, clientId: string) => {
      setLines((prev) => {
        const updated = prev.map((cur, i) => (i === index ? { ...cur, clientId } : cur));
        const target = updated[index];
        if (target) void applyHint(index, target);
        return updated;
      });
    },
    [applyHint],
  );

  const onRemove = useCallback((index: number) => {
    setLines((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  }, []);

  const addLine = useCallback(() => {
    setLines((prev) => [...prev, emptyLine(firstClient)]);
  }, [firstClient]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      startSubmit(async () => {
        const res = await splitPaymentAction({
          paymentId,
          lines: lines.map((l) => ({
            clientId: l.clientId,
            periodYear: l.periodYear,
            periodMonth: l.periodMonth,
            serviceType: l.serviceType,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            amount: l.amount,
          })),
        });
        if (res.error) setError(res.error);
        else router.push(`/payments/${paymentId}`);
      });
    },
    [router, paymentId, lines],
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <AllocationBar paymentAmount={paymentAmount} allocated={allocated} />
      {lines.map((line, index) => (
        <SplitLineRow
          key={line.key}
          index={index}
          line={line}
          clients={clients}
          canRemove={lines.length > 1}
          onPatch={onPatch}
          onClient={onClient}
          onRemove={onRemove}
        />
      ))}
      <button
        type="button"
        onClick={addLine}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
      >
        <Plus className="h-4 w-4" aria-hidden /> Додати акт
      </button>
      {error ? (
        <p className="rounded-md bg-destructive/12 px-3 py-2 text-sm text-destructive">{error}</p>
      ) : null}
      <button
        type="submit"
        disabled={pending || !matched || !allValid}
        className="h-9 rounded-lg border border-border bg-foreground px-4 text-sm font-medium text-background transition-colors hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Створення…" : "Створити акти"}
      </button>
    </form>
  );
}

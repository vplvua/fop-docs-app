"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";

import { createManualActAction, manualActHintAction } from "./actions";

export interface ContractClient {
  id: string;
  name: string;
  legalId: string;
}

const INPUT_CLASS =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring";

const MONTHS = [
  "Січень",
  "Лютий",
  "Березень",
  "Квітень",
  "Травень",
  "Червень",
  "Липень",
  "Серпень",
  "Вересень",
  "Жовтень",
  "Листопад",
  "Грудень",
];

/** amount = unitPrice × quantity, or "" when either is not a positive number. */
function computeAmount(unitPrice: string, quantity: string): string {
  const p = Number(unitPrice);
  const q = Number(quantity);
  if (!Number.isFinite(p) || !Number.isFinite(q) || p <= 0 || q <= 0) return "";
  return (p * q).toFixed(2);
}

interface FieldsProps {
  clients: ContractClient[];
  clientId: string;
  serviceType: "access" | "sms";
  periodYear: number;
  periodMonth: number;
  quantity: string;
  unitPrice: string;
  amount: string;
  bankLabel: string;
  paymentDate: string;
  onClient: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onService: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onMonth: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onYear: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onQuantity: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onUnitPrice: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onAmount: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBankLabel: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onPaymentDate: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

function ManualActFields(props: FieldsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="flex flex-col gap-1 text-sm sm:col-span-2">
        <span className="text-muted-foreground">Клієнт</span>
        <select
          aria-label="Клієнт"
          value={props.clientId}
          onChange={props.onClient}
          className={INPUT_CLASS}
        >
          {props.clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.legalId})
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted-foreground">Місяць періоду</span>
        <select
          aria-label="Місяць періоду"
          value={props.periodMonth}
          onChange={props.onMonth}
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
        <span className="text-muted-foreground">Рік періоду</span>
        <input
          aria-label="Рік періоду"
          type="number"
          min={2000}
          max={2100}
          value={props.periodYear}
          onChange={props.onYear}
          className={INPUT_CLASS}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted-foreground">Послуга</span>
        <select
          aria-label="Послуга"
          value={props.serviceType}
          onChange={props.onService}
          className={INPUT_CLASS}
        >
          <option value="access">Доступ до сервісу</option>
          <option value="sms">SMS-розсилка</option>
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted-foreground">Кількість</span>
        <input
          aria-label="Кількість"
          type="text"
          inputMode="decimal"
          value={props.quantity}
          onChange={props.onQuantity}
          className={INPUT_CLASS}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted-foreground">Ціна за одиницю</span>
        <input
          aria-label="Ціна за одиницю"
          type="text"
          inputMode="decimal"
          value={props.unitPrice}
          onChange={props.onUnitPrice}
          placeholder="за тарифом"
          className={INPUT_CLASS}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted-foreground">Сума</span>
        <input
          aria-label="Сума"
          type="text"
          inputMode="decimal"
          value={props.amount}
          onChange={props.onAmount}
          className={INPUT_CLASS}
        />
        <span className="text-xs text-muted-foreground">
          Авто = ціна × кількість, можна змінити
        </span>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted-foreground">Банк (необовʼязково)</span>
        <input
          aria-label="Банк"
          type="text"
          value={props.bankLabel}
          onChange={props.onBankLabel}
          placeholder="напр. Монобанк"
          className={INPUT_CLASS}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted-foreground">Дата платежу (необовʼязково)</span>
        <input
          aria-label="Дата платежу"
          type="date"
          value={props.paymentDate}
          onChange={props.onPaymentDate}
          className={INPUT_CLASS}
        />
        <span className="text-xs text-muted-foreground">За замовчуванням — кінець періоду</span>
      </label>
    </div>
  );
}

export function ManualActForm({ clients }: { clients: ContractClient[] }) {
  const router = useRouter();
  const now = new Date();

  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const [serviceType, setServiceType] = useState<"access" | "sms">("access");
  const [periodYear, setPeriodYear] = useState(now.getFullYear());
  const [periodMonth, setPeriodMonth] = useState(now.getMonth() + 1);
  const [quantity, setQuantity] = useState("1");
  const [unitPrice, setUnitPrice] = useState("");
  const [amount, setAmount] = useState("");
  const [amountTouched, setAmountTouched] = useState(false);
  const [bankLabel, setBankLabel] = useState("");
  const [paymentDate, setPaymentDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startSubmit] = useTransition();

  // Pull the tariff hint whenever the client/service/period changes.
  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;
    void (async () => {
      try {
        const hint = await manualActHintAction(clientId, serviceType, periodYear, periodMonth);
        if (cancelled) return;
        if (hint.unitPrice) setUnitPrice(hint.unitPrice);
        setQuantity((q) => (q && q !== "0" ? q : hint.defaultQuantity));
      } catch {
        // hint is best-effort; ignore failures
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clientId, serviceType, periodYear, periodMonth]);

  // Keep amount = price × quantity until the admin overrides it (D4).
  useEffect(() => {
    if (amountTouched) return;
    const computed = computeAmount(unitPrice, quantity);
    if (computed) setAmount(computed);
  }, [unitPrice, quantity, amountTouched]);

  const onClient = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => setClientId(e.target.value),
    [],
  );
  const onService = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => setServiceType(e.target.value as "access" | "sms"),
    [],
  );
  const onMonth = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => setPeriodMonth(Number(e.target.value)),
    [],
  );
  const onYear = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setPeriodYear(Number(e.target.value)),
    [],
  );
  const onQuantity = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setQuantity(e.target.value),
    [],
  );
  const onUnitPrice = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setUnitPrice(e.target.value),
    [],
  );
  const onAmount = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setAmountTouched(true);
    setAmount(e.target.value);
  }, []);
  const onBankLabel = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setBankLabel(e.target.value),
    [],
  );
  const onPaymentDate = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setPaymentDate(e.target.value),
    [],
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      startSubmit(async () => {
        const res = await createManualActAction({
          clientId,
          periodYear,
          periodMonth,
          serviceType,
          quantity,
          unitPrice,
          amount,
          bankLabel,
          paymentDate,
        });
        if (res.error) setError(res.error);
        else if (res.actId) router.push(`/acts/${res.actId}`);
      });
    },
    [
      router,
      clientId,
      periodYear,
      periodMonth,
      serviceType,
      quantity,
      unitPrice,
      amount,
      bankLabel,
      paymentDate,
    ],
  );

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-5">
      <ManualActFields
        clients={clients}
        clientId={clientId}
        serviceType={serviceType}
        periodYear={periodYear}
        periodMonth={periodMonth}
        quantity={quantity}
        unitPrice={unitPrice}
        amount={amount}
        bankLabel={bankLabel}
        paymentDate={paymentDate}
        onClient={onClient}
        onService={onService}
        onMonth={onMonth}
        onYear={onYear}
        onQuantity={onQuantity}
        onUnitPrice={onUnitPrice}
        onAmount={onAmount}
        onBankLabel={onBankLabel}
        onPaymentDate={onPaymentDate}
      />

      {error ? (
        <p className="rounded-md bg-destructive/12 px-3 py-2 text-sm text-destructive">{error}</p>
      ) : null}

      <button
        type="submit"
        disabled={pending || !clientId}
        className="h-9 rounded-lg border border-border bg-foreground px-4 text-sm font-medium text-background transition-colors hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Створення…" : "Створити акт і надіслати в Дубідок"}
      </button>
    </form>
  );
}

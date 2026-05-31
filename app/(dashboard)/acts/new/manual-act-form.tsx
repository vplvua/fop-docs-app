"use client";

import { Check, ChevronsUpDown, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useRef, useState, useTransition } from "react";

import { updateManualActAction } from "../[id]/act-actions";
import { createManualActAction, manualActHintAction } from "./actions";

/** Prefilled values + target act for reusing this form in edit mode. */
export interface ManualActEditConfig {
  actId: string;
  initial: {
    serviceType: "access" | "sms";
    periodYear: number;
    periodMonth: number;
    quantity: string;
    unitPrice: string;
    amount: string;
    bankLabel: string;
    paymentDate: string;
  };
}

export interface ContractClient {
  id: string;
  name: string;
  legalId: string;
  contractNumber: string;
}

export const INPUT_CLASS =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring";

export const MONTHS = [
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

/** One row in the client combobox listbox. Binds its handlers per-item so the
 * parent can pass stable callbacks (react-perf/jsx-no-new-function-as-prop). */
function ClientOption({
  client,
  index,
  active,
  selected,
  onPick,
  onActivate,
}: {
  client: ContractClient;
  index: number;
  active: boolean;
  selected: boolean;
  onPick: (id: string) => void;
  onActivate: (index: number) => void;
}) {
  const handleClick = useCallback(() => onPick(client.id), [onPick, client.id]);
  const handleMove = useCallback(() => onActivate(index), [onActivate, index]);
  return (
    // eslint-disable-next-line jsx-a11y/prefer-tag-over-role -- ARIA combobox listbox option, not a native <option>
    <div role="option" aria-selected={selected}>
      <button
        type="button"
        onClick={handleClick}
        onPointerMove={handleMove}
        className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${
          active ? "bg-muted" : ""
        }`}
      >
        <Check
          className={`h-4 w-4 shrink-0 ${selected ? "opacity-100" : "opacity-0"}`}
          aria-hidden
        />
        <span className="truncate">
          {client.name} ({client.legalId})
        </span>
      </button>
    </div>
  );
}

/**
 * Searchable client picker. The contract-client list can be long, so a plain
 * native <select> is hard to scan; this filters by a substring of both the
 * name and the EDRPOU/РНОКПП (numeric ids matched as text, per our list-search
 * convention). Locked to read-only text in edit mode, where the client is fixed.
 */
export function ClientCombobox({
  clients,
  value,
  onChange,
  disabled,
}: {
  clients: ContractClient[];
  value: string;
  onChange: (id: string) => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const selected = clients.find((c) => c.id === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) =>
      `${c.name} ${c.legalId} ${c.contractNumber}`.toLowerCase().includes(q),
    );
  }, [clients, query]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  // Focus the search box and reset the query/highlight each time it opens.
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActive(0);
    inputRef.current?.focus();
  }, [open]);

  const pick = useCallback(
    (id: string) => {
      onChange(id);
      setOpen(false);
    },
    [onChange],
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const choice = filtered[active];
        if (choice) pick(choice.id);
      } else if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
      }
    },
    [filtered, active, pick],
  );

  const toggleOpen = useCallback(() => setOpen((o) => !o), []);
  const handleQueryChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setActive(0);
  }, []);

  if (disabled) {
    return (
      <div
        className={`${INPUT_CLASS} flex cursor-not-allowed items-center opacity-70`}
        aria-label="Клієнт"
      >
        {selected ? `${selected.name} (${selected.legalId})` : "—"}
      </div>
    );
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label="Клієнт"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={toggleOpen}
        className={`${INPUT_CLASS} flex items-center justify-between gap-2 text-left`}
      >
        <span className={selected ? "truncate" : "truncate text-muted-foreground"}>
          {selected ? `${selected.name} (${selected.legalId})` : "Оберіть клієнта"}
        </span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      </button>

      {open ? (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border border-border bg-card shadow-lg">
          <div className="relative border-b border-border">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={handleQueryChange}
              onKeyDown={onKeyDown}
              placeholder="Пошук за назвою, ЄДРПОУ або № договору…"
              aria-label="Пошук клієнта"
              aria-controls={listId}
              className="h-9 w-full bg-transparent pl-8 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
          </div>
          {/* eslint-disable-next-line jsx-a11y/prefer-tag-over-role -- ARIA combobox popup, not a native <select> */}
          <div id={listId} role="listbox" className="max-h-60 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-sm text-muted-foreground">Нічого не знайдено</div>
            ) : (
              filtered.map((c, i) => (
                <ClientOption
                  key={c.id}
                  client={c}
                  index={i}
                  active={i === active}
                  selected={c.id === value}
                  onPick={pick}
                  onActivate={setActive}
                />
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

interface FieldsProps {
  clients: ContractClient[];
  clientId: string;
  /** Client and period are immutable in edit mode (they fix the act number + snapshots). */
  readOnlyIdentity: boolean;
  serviceType: "access" | "sms";
  periodYear: number;
  periodMonth: number;
  quantity: string;
  unitPrice: string;
  amount: string;
  bankLabel: string;
  paymentDate: string;
  onClient: (id: string) => void;
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
      <div className="flex flex-col gap-1 text-sm sm:col-span-2">
        <span className="text-muted-foreground">Клієнт</span>
        <ClientCombobox
          clients={props.clients}
          value={props.clientId}
          onChange={props.onClient}
          disabled={props.readOnlyIdentity}
        />
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted-foreground">Місяць періоду</span>
        <select
          aria-label="Місяць періоду"
          value={props.periodMonth}
          onChange={props.onMonth}
          disabled={props.readOnlyIdentity}
          className={`${INPUT_CLASS} disabled:cursor-not-allowed disabled:opacity-70`}
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
          disabled={props.readOnlyIdentity}
          className={`${INPUT_CLASS} disabled:cursor-not-allowed disabled:opacity-70`}
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

export function ManualActForm({
  clients,
  edit,
}: {
  clients: ContractClient[];
  edit?: ManualActEditConfig;
}) {
  const router = useRouter();
  const now = new Date();
  const isEdit = Boolean(edit);
  const init = edit?.initial;

  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const [serviceType, setServiceType] = useState<"access" | "sms">(init?.serviceType ?? "access");
  const [periodYear, setPeriodYear] = useState(init?.periodYear ?? now.getFullYear());
  const [periodMonth, setPeriodMonth] = useState(init?.periodMonth ?? now.getMonth() + 1);
  const [quantity, setQuantity] = useState(init?.quantity ?? "1");
  const [unitPrice, setUnitPrice] = useState(init?.unitPrice ?? "");
  const [amount, setAmount] = useState(init?.amount ?? "");
  // In edit mode the amount is already authoritative — never auto-recompute it.
  const [amountTouched, setAmountTouched] = useState(isEdit);
  const [bankLabel, setBankLabel] = useState(init?.bankLabel ?? "");
  const [paymentDate, setPaymentDate] = useState(init?.paymentDate ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startSubmit] = useTransition();

  // Pull the tariff hint whenever the client/service/period changes — create only;
  // in edit mode the stored values are authoritative and must not be overwritten.
  useEffect(() => {
    if (isEdit || !clientId) return;
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
  }, [isEdit, clientId, serviceType, periodYear, periodMonth]);

  // Keep amount = price × quantity until the admin overrides it (D4).
  useEffect(() => {
    if (amountTouched) return;
    const computed = computeAmount(unitPrice, quantity);
    if (computed) setAmount(computed);
  }, [unitPrice, quantity, amountTouched]);

  const onClient = useCallback((id: string) => setClientId(id), []);
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
        if (edit) {
          const res = await updateManualActAction(edit.actId, {
            serviceType,
            quantity,
            unitPrice,
            amount,
            bankLabel,
            paymentDate,
          });
          if (res.ok) router.push(`/acts/${edit.actId}`);
          else setError(res.error ?? "Невідома помилка");
          return;
        }
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
      edit,
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
        readOnlyIdentity={isEdit}
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
        {isEdit
          ? pending
            ? "Збереження…"
            : "Зберегти зміни"
          : pending
            ? "Створення…"
            : "Створити акт і надіслати в Дубідок"}
      </button>
    </form>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import {
  classifyPaymentAction,
  linkPaymentClientAction,
  skipPaymentAction,
} from "./classification-actions";

export interface ClientCandidate {
  id: string;
  name: string;
  moeosbbUserId: number | null;
  contractNumber: string | null;
}

const REASON_GUIDANCE: Record<string, string> = {
  no_match:
    "Платіж не вдалося зіставити з жодним клієнтом. Створіть нового клієнта або перевірте ЄДРПОУ.",
  multiple_contracts:
    "У призначенні знайдено кілька номерів договорів. Виправте призначення або оберіть потрібний.",
  multiple_clients_same_edrpou:
    "Кілька активних клієнтів мають цей ЄДРПОУ. Оберіть, до якого привʼязати платіж.",
  ambiguous_client: "Договір знайдено, але ЄДРПОУ платника не збігається з ЄДРПОУ клієнта.",
  client_incomplete: "У клієнта відсутні обовʼязкові поля для генерації акту.",
  amount_mismatch: "Сума платежу не ділиться на тариф без залишку.",
  sms_quantity_mismatch:
    "Не вдалося розпізнати кількість СМС або сума не відповідає кількості × ціна.",
  auto_act_disabled: "Автогенерація актів вимкнена для цього клієнта.",
  external_edo: "Клієнт використовує Вчасно — акт потрібно створити вручну.",
};

function parseReason(raw: string): { key: string; detail: string | null } {
  const idx = raw.indexOf(":");
  if (idx === -1) return { key: raw, detail: null };
  return { key: raw.slice(0, idx), detail: raw.slice(idx + 1) };
}

function SkippedBadge() {
  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <span className="inline-flex items-center rounded-md bg-muted px-2.5 py-1 text-sm font-medium text-muted-foreground">
        Пропущено
      </span>
    </div>
  );
}

function ClassifiedInfo({ actId }: { actId: string | null }) {
  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <h2 className="text-sm font-medium text-muted-foreground">Класифікація</h2>
      <p className="mt-2 text-sm text-foreground">
        Платіж класифіковано.{" "}
        {actId ? (
          <Link href={`/acts/${actId}`} className="text-primary underline underline-offset-2">
            Переглянути акт →
          </Link>
        ) : null}
      </p>
    </div>
  );
}

function ReasonDetails({
  classificationReason,
  clientId,
}: {
  classificationReason: string | null;
  clientId: string | null;
}) {
  if (!classificationReason) {
    return <p className="text-sm text-muted-foreground">Платіж ще не класифіковано.</p>;
  }

  const { key, detail } = parseReason(classificationReason);
  // For multiple_clients_same_edrpou the detail is the raw candidate id list —
  // not meaningful to the operator (the selector below shows the choices).
  const showDetail = detail && key !== "multiple_clients_same_edrpou";
  return (
    <div className="space-y-2">
      <p className="text-sm text-foreground">{REASON_GUIDANCE[key] ?? `Причина: ${key}`}</p>
      {showDetail ? <p className="text-xs text-muted-foreground">Деталі: {detail}</p> : null}
      {clientId ? (
        <p className="text-xs text-muted-foreground">
          <Link href={`/clients/${clientId}`} className="text-primary underline underline-offset-2">
            Перейти до клієнта →
          </Link>
        </p>
      ) : null}
    </div>
  );
}

function CandidateRow({
  candidate,
  busy,
  pending,
  onLink,
}: {
  candidate: ClientCandidate;
  busy: boolean;
  pending: boolean;
  onLink: (clientId: string) => void;
}) {
  const handleClick = useCallback(() => onLink(candidate.id), [onLink, candidate.id]);
  return (
    <li className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground">{candidate.name}</p>
        <p className="text-xs text-muted-foreground">
          Договір: {candidate.contractNumber ?? "—"} · Моє ОСББ: {candidate.moeosbbUserId ?? "—"}
        </p>
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={handleClick}
        className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
      >
        {pending ? "Привʼязка…" : "Привʼязати"}
      </button>
    </li>
  );
}

function ClientSelector({
  paymentId,
  candidates,
}: {
  paymentId: string;
  candidates: ClientCandidate[];
}) {
  const router = useRouter();
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleLink = useCallback(
    async (clientId: string) => {
      setLinkingId(clientId);
      setError(null);
      const result = await linkPaymentClientAction(paymentId, clientId);
      setLinkingId(null);
      if (result.ok) router.refresh();
      else setError(result.error ?? "Помилка привʼязки");
    },
    [paymentId, router],
  );

  return (
    <div className="space-y-2">
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <ul className="space-y-2">
        {candidates.map((c) => (
          <CandidateRow
            key={c.id}
            candidate={c}
            busy={linkingId !== null}
            pending={linkingId === c.id}
            onLink={handleLink}
          />
        ))}
      </ul>
    </div>
  );
}

function ActionButtons({ paymentId }: { paymentId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState<"classify" | "skip" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleClassify = useCallback(async () => {
    setLoading("classify");
    setError(null);
    const result = await classifyPaymentAction(paymentId);
    setLoading(null);
    if (result.ok) router.refresh();
    else setError(result.error ?? "Помилка класифікації");
  }, [paymentId, router]);

  const handleSkip = useCallback(async () => {
    setLoading("skip");
    setError(null);
    const result = await skipPaymentAction(paymentId);
    setLoading(null);
    if (result.ok) router.refresh();
    else setError(result.error ?? "Помилка");
  }, [paymentId, router]);

  return (
    <div className="space-y-4">
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="flex gap-3">
        <button
          type="button"
          disabled={loading !== null}
          onClick={handleClassify}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {loading === "classify" ? "Класифікація…" : "Класифікувати"}
        </button>
        <button
          type="button"
          disabled={loading !== null}
          onClick={handleSkip}
          className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
        >
          {loading === "skip" ? "Пропуск…" : "Пропустити"}
        </button>
      </div>
    </div>
  );
}

interface Props {
  paymentId: string;
  status: string;
  classificationReason: string | null;
  actId: string | null;
  clientId: string | null;
  candidates: ClientCandidate[];
}

export function ClassificationPanel({
  paymentId,
  status,
  classificationReason,
  actId,
  clientId,
  candidates,
}: Props) {
  if (status === "skipped") return <SkippedBadge />;
  if (status === "classified") return <ClassifiedInfo actId={actId} />;

  const isActionable =
    status === "received" || status === "awaiting_review" || status === "in_queue";

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-4">
      <h2 className="text-sm font-medium text-muted-foreground">Класифікація</h2>
      <ReasonDetails classificationReason={classificationReason} clientId={clientId} />
      {candidates.length > 0 ? (
        <ClientSelector paymentId={paymentId} candidates={candidates} />
      ) : null}
      {isActionable ? <ActionButtons paymentId={paymentId} /> : null}
    </div>
  );
}

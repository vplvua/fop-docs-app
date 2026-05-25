"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import { classifyPaymentAction, skipPaymentAction } from "./classification-actions";

const REASON_GUIDANCE: Record<string, string> = {
  no_match:
    "Платіж не вдалося зіставити з жодним клієнтом. Створіть нового клієнта або перевірте ЄДРПОУ.",
  multiple_contracts:
    "У призначенні знайдено кілька номерів договорів. Виправте призначення або оберіть потрібний.",
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
  return (
    <div className="space-y-2">
      <p className="text-sm text-foreground">{REASON_GUIDANCE[key] ?? `Причина: ${key}`}</p>
      {detail ? <p className="text-xs text-muted-foreground">Деталі: {detail}</p> : null}
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

interface Props {
  paymentId: string;
  status: string;
  classificationReason: string | null;
  actId: string | null;
  clientId: string | null;
}

export function ClassificationPanel({
  paymentId,
  status,
  classificationReason,
  actId,
  clientId,
}: Props) {
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

  if (status === "skipped") return <SkippedBadge />;
  if (status === "classified") return <ClassifiedInfo actId={actId} />;

  const isActionable =
    status === "received" || status === "awaiting_review" || status === "in_queue";

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-4">
      <h2 className="text-sm font-medium text-muted-foreground">Класифікація</h2>
      <ReasonDetails classificationReason={classificationReason} clientId={clientId} />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {isActionable ? (
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
      ) : null}
    </div>
  );
}

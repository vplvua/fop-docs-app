"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import { REASON_GUIDANCE } from "@/lib/queue/reasons";

import {
  classifyPaymentAction,
  linkPaymentClientAction,
  skipPaymentAction,
} from "@/app/(dashboard)/payments/[id]/classification-actions";
import { ClientSelector } from "./client-selector";
import {
  ExternalEdoBody,
  MismatchBody,
  MissingFieldsBody,
  MultipleContractsBody,
  NoMatchBody,
} from "./reason-bodies";
import type { QueueItemVM } from "./types";

interface LinkProps {
  onLink: (clientId: string) => void;
  linkingId: string | null;
  linkError: string | null;
}

function ReasonBody({ item, ...linkProps }: { item: QueueItemVM } & LinkProps) {
  switch (item.reasonKey) {
    case "no_match":
      return <NoMatchBody item={item} {...linkProps} />;
    case "multiple_clients_same_edrpou":
      return item.candidates.length > 0 ? (
        <ClientSelector
          candidates={item.candidates}
          onLink={linkProps.onLink}
          linkingId={linkProps.linkingId}
          error={linkProps.linkError}
        />
      ) : null;
    case "client_incomplete":
      return <MissingFieldsBody item={item} />;
    case "multiple_contracts":
      return <MultipleContractsBody item={item} />;
    case "amount_mismatch":
    case "sms_quantity_mismatch":
      return <MismatchBody item={item} />;
    case "external_edo":
      return <ExternalEdoBody />;
    default:
      // ambiguous_client (legacy, read-only) and auto_act_disabled show only
      // the guidance line + footer actions.
      return null;
  }
}

function CardFooter({
  loading,
  onClassify,
  onSkip,
}: {
  loading: "classify" | "skip" | null;
  onClassify: () => void;
  onSkip: () => void;
}) {
  return (
    <div className="mt-4 flex gap-3">
      <button
        type="button"
        disabled={loading !== null}
        onClick={onClassify}
        className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50"
      >
        {loading === "classify" ? "Класифікація…" : "Класифікувати ще раз"}
      </button>
      <button
        type="button"
        disabled={loading !== null}
        onClick={onSkip}
        className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50"
      >
        {loading === "skip" ? "Пропуск…" : "Пропустити"}
      </button>
    </div>
  );
}

export function QueueCard({ item }: { item: QueueItemVM }) {
  const router = useRouter();
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [loading, setLoading] = useState<"classify" | "skip" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleLink = useCallback(
    async (clientId: string) => {
      setLinkingId(clientId);
      setLinkError(null);
      const result = await linkPaymentClientAction(item.id, clientId);
      setLinkingId(null);
      if (result.ok) router.refresh();
      else setLinkError(result.error ?? "Помилка привʼязки");
    },
    [item.id, router],
  );

  const handleClassify = useCallback(async () => {
    setLoading("classify");
    setActionError(null);
    const result = await classifyPaymentAction(item.id);
    setLoading(null);
    if (result.ok) router.refresh();
    else setActionError(result.error ?? "Помилка класифікації");
  }, [item.id, router]);

  const handleSkip = useCallback(async () => {
    setLoading("skip");
    setActionError(null);
    const result = await skipPaymentAction(item.id);
    setLoading(null);
    if (result.ok) router.refresh();
    else setActionError(result.error ?? "Помилка");
  }, [item.id, router]);

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground" title={item.purpose}>
            {item.purpose}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {item.paymentDate} · {item.amount} грн · {item.payerName} · ЄДРПОУ {item.payerLegalId}
          </p>
        </div>
        <Link
          href={`/payments/${item.id}`}
          className="shrink-0 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          Деталі →
        </Link>
      </div>

      <p className="mt-3 text-sm text-foreground">
        {REASON_GUIDANCE[item.reasonKey] ?? `Причина: ${item.reasonKey}`}
      </p>

      <div className="mt-3">
        <ReasonBody item={item} onLink={handleLink} linkingId={linkingId} linkError={linkError} />
      </div>

      {actionError ? <p className="mt-3 text-sm text-destructive">{actionError}</p> : null}

      <CardFooter loading={loading} onClassify={handleClassify} onSkip={handleSkip} />
    </div>
  );
}

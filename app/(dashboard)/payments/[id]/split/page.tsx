import { asc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { db } from "@/lib/db";
import { clients } from "@/lib/db/schema/clients";
import { contracts } from "@/lib/db/schema/contracts";
import { payments } from "@/lib/db/schema/payments";
import { getTransitEdrpouList } from "@/lib/settings";

import { PageContainer } from "@/app/components/page-container";

import { type ContractClient } from "../../../acts/new/manual-act-form";
import { SplitForm } from "./split-form";

export const metadata = { title: "Розділити платіж · ФОП Документи" };

const SPLITTABLE = new Set(["received", "awaiting_review", "in_queue", "skipped"]);

/** Contract-bearing clients eligible for the split. For a normal payment the
 * payer is fixed by EDRPOU, so we scope to `payerLegalId` — that stops the form
 * from defaulting to an arbitrary unrelated client (mirrors classification
 * matching). For a transit/aggregated payer the EDRPOU belongs to the
 * intermediary bank and cannot identify the client (D-008/D-027), so we keep the
 * full contract-client list and let the operator pick per line (`legalId === null`). */
function loadEligibleClients(payerLegalId: string | null): Promise<ContractClient[]> {
  return db
    .select({
      id: clients.id,
      name: clients.name,
      legalId: clients.legalId,
      contractNumber: contracts.number,
    })
    .from(contracts)
    .innerJoin(clients, eq(clients.id, contracts.clientId))
    .where(payerLegalId === null ? undefined : eq(clients.legalId, payerLegalId))
    .orderBy(asc(clients.name));
}

interface Props {
  params: Promise<{ id: string }>;
}

function PaymentSummary({
  payment,
  isTransit,
}: {
  payment: { amount: string; purpose: string; payerName: string; payerLegalId: string };
  isTransit: boolean;
}) {
  return (
    <div className="space-y-1 rounded-xl border border-border bg-card p-4 text-sm">
      <div>
        <span className="text-muted-foreground">Платіж:</span>{" "}
        <strong className="text-foreground">{payment.amount} грн</strong>{" "}
        <span className="text-muted-foreground">· {payment.purpose}</span>
      </div>
      <div>
        <span className="text-muted-foreground">Платник:</span>{" "}
        <span className="text-foreground">{payment.payerName}</span>{" "}
        <span className="text-muted-foreground">· ЄДРПОУ {payment.payerLegalId}</span>
        {isTransit ? (
          <span className="text-muted-foreground"> · транзитний (банк-посередник)</span>
        ) : null}
      </div>
    </div>
  );
}

export default async function SplitPaymentPage({ params }: Props) {
  const { id } = await params;
  const [payment] = await db
    .select({
      id: payments.id,
      amount: payments.amount,
      status: payments.status,
      purpose: payments.purpose,
      payerName: payments.payerName,
      payerLegalId: payments.payerLegalId,
    })
    .from(payments)
    .where(eq(payments.id, id))
    .limit(1);
  if (!payment) notFound();
  // A classified payment must be un-split before re-splitting; bounce back.
  if (!SPLITTABLE.has(payment.status)) redirect(`/payments/${id}`);

  // Transit/aggregated payer (D-008/D-027): the EDRPOU is the intermediary
  // bank's, so the split is not anchored to one payer — keep the cross-client
  // picker. Otherwise the payer is fixed and we scope the act(s) to its EDRPOU.
  const transitList = await getTransitEdrpouList();
  const isTransit = transitList.includes(payment.payerLegalId);
  const eligibleClients = await loadEligibleClients(isTransit ? null : payment.payerLegalId);

  return (
    <PageContainer>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-heading-2 text-foreground">Розділити платіж на акти</h1>
          <Link
            href={`/payments/${id}`}
            className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            ← До платежу
          </Link>
        </div>
        <p className="max-w-2xl text-sm text-muted-foreground">
          {isTransit
            ? "Транзитний платіж може покривати акти для різних клієнтів. Додайте акти так, щоб їхня сума точно дорівнювала сумі платежу — кожен акт буде привʼязаний до цього платежу."
            : "Один платіж покриває кілька послуг для того самого платника. Додайте акти так, щоб їхня сума точно дорівнювала сумі платежу — кожен акт буде привʼязаний до цього платежу й до платника за ЄДРПОУ."}
        </p>
        <PaymentSummary payment={payment} isTransit={isTransit} />
        {eligibleClients.length === 0 ? (
          <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
            {isTransit
              ? "Немає клієнтів з договором. Додайте договір клієнту, щоб створити акт."
              : `У платника «${payment.payerName}» (ЄДРПОУ ${payment.payerLegalId}) немає клієнта з договором. Додайте договір цьому клієнту, щоб створити акт.`}
          </p>
        ) : (
          <SplitForm
            paymentId={payment.id}
            paymentAmount={payment.amount}
            payerName={payment.payerName}
            payerLegalId={payment.payerLegalId}
            isTransit={isTransit}
            clients={eligibleClients}
          />
        )}
      </div>
    </PageContainer>
  );
}

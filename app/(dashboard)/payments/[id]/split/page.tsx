import { asc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { db } from "@/lib/db";
import { clients } from "@/lib/db/schema/clients";
import { contracts } from "@/lib/db/schema/contracts";
import { payments } from "@/lib/db/schema/payments";

import { PageContainer } from "@/app/components/page-container";

import { type ContractClient } from "../../../acts/new/manual-act-form";
import { SplitForm } from "./split-form";

export const metadata = { title: "Розділити платіж · ФОП Документи" };

const SPLITTABLE = new Set(["received", "awaiting_review", "in_queue", "skipped"]);

/** Clients with a contract — the only ones eligible for an act (PDF needs the
 * contract snapshot). Mirrors the manual-act picker loader. */
async function loadContractClients(): Promise<ContractClient[]> {
  return db
    .select({
      id: clients.id,
      name: clients.name,
      legalId: clients.legalId,
      contractNumber: contracts.number,
    })
    .from(contracts)
    .innerJoin(clients, eq(clients.id, contracts.clientId))
    .orderBy(asc(clients.name));
}

interface Props {
  params: Promise<{ id: string }>;
}

export default async function SplitPaymentPage({ params }: Props) {
  const { id } = await params;
  const [payment] = await db
    .select({
      id: payments.id,
      amount: payments.amount,
      status: payments.status,
      purpose: payments.purpose,
    })
    .from(payments)
    .where(eq(payments.id, id))
    .limit(1);
  if (!payment) notFound();
  // A classified payment must be un-split before re-splitting; bounce back.
  if (!SPLITTABLE.has(payment.status)) redirect(`/payments/${id}`);

  const contractClients = await loadContractClients();

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
          Один платіж покриває кілька послуг або кілька клієнтів. Додайте акти так, щоб їхня сума
          точно дорівнювала сумі платежу — кожен акт буде привʼязаний до цього самого платежу.
        </p>
        <div className="rounded-xl border border-border bg-card p-4 text-sm">
          <span className="text-muted-foreground">Платіж:</span>{" "}
          <strong className="text-foreground">{payment.amount} грн</strong>{" "}
          <span className="text-muted-foreground">· {payment.purpose}</span>
        </div>
        {contractClients.length === 0 ? (
          <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
            Немає клієнтів з договором. Додайте договір клієнту, щоб створити акт.
          </p>
        ) : (
          <SplitForm
            paymentId={payment.id}
            paymentAmount={payment.amount}
            clients={contractClients}
          />
        )}
      </div>
    </PageContainer>
  );
}

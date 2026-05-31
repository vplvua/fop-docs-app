import { asc, eq, inArray } from "drizzle-orm";
import { notFound } from "next/navigation";

import { isSplitPayment } from "@/lib/acts/split-origin";
import { db } from "@/lib/db";
import { acts } from "@/lib/db/schema/acts";
import { clients } from "@/lib/db/schema/clients";
import { contracts } from "@/lib/db/schema/contracts";
import { payments } from "@/lib/db/schema/payments";

import { PageContainer } from "@/app/components/page-container";

import { ClassificationPanel, type ClientCandidate, type LinkedAct } from "./classification-panel";

const STATUS_LABELS: Record<string, string> = {
  received: "Отримано",
  classified: "Класифіковано",
  awaiting_review: "На апрув",
  in_queue: "У черзі",
  skipped: "Пропущено",
};

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const [p] = await db
    .select({ purpose: payments.purpose })
    .from(payments)
    .where(eq(payments.id, id))
    .limit(1);
  const title = p ? `${p.purpose.slice(0, 40)}… · Платіж` : "Платіж";
  return { title: `${title} · ФОП Документи` };
}

async function loadCandidates(classificationReason: string | null): Promise<ClientCandidate[]> {
  if (!classificationReason?.startsWith("multiple_clients_same_edrpou:")) return [];
  const ids = classificationReason
    .slice("multiple_clients_same_edrpou:".length)
    .split(",")
    .filter(Boolean);
  if (ids.length === 0) return [];
  const rows = await db
    .select({
      id: clients.id,
      name: clients.name,
      moeosbbUserId: clients.moeosbbUserId,
      contractNumber: contracts.number,
    })
    .from(clients)
    .leftJoin(contracts, eq(contracts.clientId, clients.id))
    .where(inArray(clients.id, ids));
  return rows;
}

/** Acts backing this payment — the canonical set (reverse lookup), since a split
 * links several acts to one payment (D-042). */
async function loadLinkedActs(paymentId: string): Promise<LinkedAct[]> {
  return db
    .select({
      id: acts.id,
      number: acts.number,
      amount: acts.amount,
      status: acts.status,
    })
    .from(acts)
    .where(eq(acts.paymentId, paymentId))
    .orderBy(asc(acts.number));
}

export default async function PaymentPage({ params }: Props) {
  const { id } = await params;
  const [payment] = await db.select().from(payments).where(eq(payments.id, id)).limit(1);
  if (!payment) notFound();

  const [candidates, linkedActs] = await Promise.all([
    loadCandidates(payment.classificationReason),
    loadLinkedActs(payment.id),
  ]);
  // The split marker lives on classification_reason; never surface it as a reason.
  const showReason = payment.classificationReason && !isSplitPayment(payment.classificationReason);

  return (
    <PageContainer>
      <div className="space-y-6">
        <h1 className="text-heading-2 text-foreground">Платіж</h1>
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <dl className="grid gap-4 sm:grid-cols-2">
            <Field label="Дата" value={payment.paymentDate} />
            <Field label="Сума" value={`${payment.amount} грн`} />
            <Field label="Призначення" value={payment.purpose} full />
            <Field label="Платник" value={payment.payerName} />
            <Field label="ЄДРПОУ" value={payment.payerLegalId} />
            <Field label="IBAN" value={payment.payerBankAccount ?? "—"} />
            <Field label="Статус" value={STATUS_LABELS[payment.status] ?? payment.status} />
            <Field label="ID транзакції" value={payment.bankTransactionId} />
            {showReason ? (
              <Field label="Причина" value={payment.classificationReason ?? ""} />
            ) : null}
          </dl>
        </div>
        <ClassificationPanel
          paymentId={payment.id}
          status={payment.status}
          classificationReason={payment.classificationReason}
          clientId={payment.clientId}
          candidates={candidates}
          acts={linkedActs}
        />
        <details className="rounded-xl border border-border bg-card shadow-sm">
          <summary className="cursor-pointer px-6 py-4 text-sm font-medium text-foreground">
            raw_data (JSON)
          </summary>
          <pre className="overflow-x-auto border-t border-border px-6 py-4 text-xs text-muted-foreground">
            {JSON.stringify(payment.rawData, null, 2)}
          </pre>
        </details>
      </div>
    </PageContainer>
  );
}

function Field({
  label,
  value,
  full,
}: {
  label: string;
  value: string;
  full?: boolean | undefined;
}) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <dt className="text-sm font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm text-foreground">{value}</dd>
    </div>
  );
}

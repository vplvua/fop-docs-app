import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";

import { db } from "@/lib/db";
import { acts } from "@/lib/db/schema/acts";
import type { ClientSnapshot, ContractSnapshot } from "@/lib/classification/types";

import { ActDetailPanel } from "./act-detail-panel";

const STATUS_LABELS: Record<string, string> = {
  draft: "Чернетка",
  sent_to_edo: "Відправлено в ЕДО",
  signed: "Підписано",
  deleted: "Видалено",
};

// Soft-tag treatment (tinted bg + deep text) per DESIGN.md badge-tag-* and D-DS-03.
const STATUS_BADGES: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  sent_to_edo: "bg-warning/12 text-warning-deep",
  signed: "bg-success/12 text-success-deep",
  deleted: "bg-destructive/12 text-destructive-deep",
};

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const [a] = await db.select({ number: acts.number }).from(acts).where(eq(acts.id, id)).limit(1);
  const title = a ? `Акт ${a.number}` : "Акт";
  return { title: `${title} · ФОП Документи` };
}

function SnapshotPanel({ act }: { act: typeof acts.$inferSelect }) {
  const client = act.clientSnapshot as ClientSnapshot;
  const contract = act.contractSnapshot as ContractSnapshot;
  const total = Number(act.amount).toFixed(2);

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <p className="mb-4 text-xs font-medium text-muted-foreground">
        Збережено на момент генерації
      </p>
      <dl className="grid gap-4 sm:grid-cols-2">
        <Field label="Клієнт" value={client.name} />
        <Field label="ЄДРПОУ" value={client.legalId} />
        <Field label="Адреса" value={client.address} full />
        <Field label="Банк" value={client.bankName ?? "—"} />
        <Field label="Рахунок" value={client.bankAccount ?? "—"} />
        <Field label="Email" value={client.email} />
        <Field label="Договір" value={`№${contract.number} від ${contract.signedDate}`} />
        <Field label="Тип послуги" value={act.serviceType} />
        <Field label="Ціна" value={`${act.unitPrice} грн`} />
        <Field label="Кількість" value={`${act.quantity} ${act.quantityUnit}`} />
        <Field label="Сума" value={`${total} грн`} />
      </dl>
    </div>
  );
}

export default async function ActPage({ params }: Props) {
  const { id } = await params;
  const [act] = await db.select().from(acts).where(eq(acts.id, id)).limit(1);
  if (!act) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-heading-2 text-foreground">Акт {act.number}</h1>
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGES[act.status] ?? "bg-muted text-muted-foreground"}`}
        >
          {STATUS_LABELS[act.status] ?? act.status}
        </span>
      </div>
      <SnapshotPanel act={act} />
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <ActDetailPanel
          actId={act.id}
          status={act.status}
          edoProvider={act.edoProvider}
          serviceDescription={act.serviceDescription}
          edoDocId={act.edoDocId}
          edoStatus={act.edoStatus}
        />
      </div>
    </div>
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

import { eq } from "drizzle-orm";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { isEditableManualAct } from "@/lib/acts/manual-act-eligibility";
import { extractMonth, extractYear } from "@/lib/acts/numbering";
import { db } from "@/lib/db";
import { acts, type Act } from "@/lib/db/schema/acts";
import { clients } from "@/lib/db/schema/clients";
import { payments } from "@/lib/db/schema/payments";

import { PageContainer } from "@/app/components/page-container";

import {
  ManualActForm,
  type ContractClient,
  type ManualActEditConfig,
} from "../../new/manual-act-form";

export const metadata = { title: "Редагувати акт · ФОП Документи" };

interface Props {
  params: Promise<{ id: string }>;
}

/** Editable manual act + its backing payment fields and the owning client. */
async function loadEditData(id: string) {
  const [row] = await db
    .select({
      act: acts,
      source: payments.source,
      bankLabel: payments.bankLabel,
      paymentDate: payments.paymentDate,
    })
    .from(acts)
    .innerJoin(payments, eq(acts.paymentId, payments.id))
    .where(eq(acts.id, id))
    .limit(1);
  if (!row) return null;

  const { act } = row;
  if (
    !isEditableManualAct({ source: row.source, status: act.status, edoProvider: act.edoProvider })
  ) {
    return { redirectTo: `/acts/${id}` as const };
  }

  const [client] = await db
    .select({ id: clients.id, name: clients.name, legalId: clients.legalId })
    .from(clients)
    .where(eq(clients.id, act.clientId))
    .limit(1);
  if (!client) return null;

  return { act, client, bankLabel: row.bankLabel, paymentDate: row.paymentDate };
}

/** Build the form props (literals live here, not in the rendering component). */
function buildFormProps(
  act: Act,
  client: ContractClient,
  bankLabel: string | null,
  paymentDate: string,
): { clients: ContractClient[]; edit: ManualActEditConfig } {
  return {
    clients: [client],
    edit: {
      actId: act.id,
      initial: {
        serviceType: act.serviceType === "sms" ? "sms" : "access",
        periodYear: extractYear(act.actDate),
        periodMonth: extractMonth(act.actDate),
        quantity: act.quantity,
        unitPrice: act.unitPrice,
        amount: act.amount,
        bankLabel: bankLabel ?? "",
        paymentDate,
      },
    },
  };
}

export default async function EditManualActPage({ params }: Props) {
  const { id } = await params;
  const data = await loadEditData(id);
  if (!data) notFound();
  if ("redirectTo" in data) redirect(data.redirectTo);

  const { act, client, bankLabel, paymentDate } = data;
  const formProps = buildFormProps(act, client, bankLabel, paymentDate);

  return (
    <PageContainer>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-heading-2 text-foreground">Редагувати акт {act.number}</h1>
          <Link
            href={`/acts/${id}`}
            className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            ← До акту
          </Link>
        </div>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Клієнт і період незмінні — вони визначають номер акту та збережені дані. Зміна
          суми/кількості оновлює акт, фоновий платіж і PDF.
        </p>
        <ManualActForm {...formProps} />
      </div>
    </PageContainer>
  );
}

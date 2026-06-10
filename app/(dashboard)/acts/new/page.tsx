import { eq, sql } from "drizzle-orm";
import Link from "next/link";

import { db } from "@/lib/db";
import { clients } from "@/lib/db/schema/clients";
import { contracts } from "@/lib/db/schema/contracts";

import { PageContainer } from "@/app/components/page-container";

import { ManualActForm, type ContractClient } from "./manual-act-form";

export const metadata = { title: "Створити акт вручну · ФОП Документи" };

// Without this the page is prerendered at build time and the client picker
// serves a frozen DB snapshot until the next deploy.
export const dynamic = "force-dynamic";

/**
 * Active clients that have a contract — the only ones eligible for a manual act,
 * since the PDF preamble requires a `contract_snapshot` (D5). Archived clients
 * (`auto_act_disabled`) are excluded: MoeOSBB junk duplicates land there and
 * would shadow the real client under the same EDRPOU.
 */
async function loadContractClients(): Promise<ContractClient[]> {
  // Inner-join the contract so the picker can also search by contract number;
  // the unique index on contracts.client_id guarantees at most one row per client.
  const rows = await db
    .select({
      id: clients.id,
      name: clients.name,
      shortName: clients.shortName,
      legalId: clients.legalId,
      contractNumber: contracts.number,
    })
    .from(contracts)
    .innerJoin(clients, eq(clients.id, contracts.clientId))
    .where(eq(clients.autoActDisabled, false))
    .orderBy(
      sql`nullif(${clients.shortName}, '') asc nulls last`,
      sql`nullif(${clients.name}, '') asc nulls last`,
    );
  return rows;
}

export default async function NewManualActPage() {
  const contractClients = await loadContractClients();

  return (
    <PageContainer>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-heading-2 text-foreground">Створити акт вручну</h1>
          <Link
            href="/acts"
            className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            ← До актів
          </Link>
        </div>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Для платежів, що не надійшли через ПриватБанк (інший банк або період до запуску додатку).
          Створюється акт і фоновий платіж-підтвердження; акт надсилається в Дубідок на підпис.
        </p>
        {contractClients.length === 0 ? (
          <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
            Немає клієнтів з договором. Додайте договір клієнту, щоб створити акт.
          </p>
        ) : (
          <ManualActForm clients={contractClients} />
        )}
      </div>
    </PageContainer>
  );
}

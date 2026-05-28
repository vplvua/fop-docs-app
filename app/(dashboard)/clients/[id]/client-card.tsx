"use client";

import Link from "next/link";

import type { acts } from "@/lib/db/schema/acts";
import type { Client } from "@/lib/db/schema/clients";
import type { Contract } from "@/lib/db/schema/contracts";
import type { payments } from "@/lib/db/schema/payments";

import { activateClientAction, archiveClientAction } from "../actions";

import { ClientInfoForm } from "./client-info-form";
import { ClientActsTab, ClientPaymentsTab } from "./client-related";
import { ClientSyncButton } from "./client-sync-button";
import { ContractForm } from "./contract-form";

type Payment = typeof payments.$inferSelect;
type Act = typeof acts.$inferSelect;

const TABS = [
  { key: "info", label: "Загальна інформація" },
  { key: "contract", label: "Договір" },
  { key: "payments", label: "Платежі" },
  { key: "acts", label: "Акти" },
] as const;

function TabNav({ clientId, active }: { clientId: string; active: string }) {
  return (
    <nav className="flex gap-1 border-b border-border">
      {TABS.map((t) => (
        <Link
          key={t.key}
          href={`/clients/${clientId}?tab=${t.key}`}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            active === t.key
              ? "border-b-2 border-primary text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

function ArchiveButton({ client }: { client: Client }) {
  const isArchived = client.autoActDisabled;
  const action = isArchived ? activateClientAction : archiveClientAction;
  const label = isArchived ? "Активувати" : "Архівувати";
  return (
    <form action={action}>
      <input type="hidden" name="id" value={client.id} />
      <button
        type="submit"
        className={`inline-flex h-8 items-center rounded-md border px-3 text-sm font-medium transition-colors ${
          isArchived
            ? "border-primary/30 bg-primary/10 text-primary hover:bg-primary/20"
            : "border-border bg-background text-muted-foreground hover:bg-accent"
        }`}
      >
        {label}
      </button>
    </form>
  );
}

function ContractWarning() {
  return (
    <div
      role="alert"
      className="rounded-md border border-amber-300/50 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-700/50 dark:bg-amber-950/30 dark:text-amber-200"
    >
      Без договору акти не генеруються.
    </div>
  );
}

function TabContent({
  tab,
  client,
  contract,
  payments,
  acts,
}: {
  tab: string;
  client: Client;
  contract: Contract | null;
  payments: Payment[];
  acts: Act[];
}) {
  switch (tab) {
    case "contract":
      return <ContractForm contract={contract} client={client} />;
    case "payments":
      return <ClientPaymentsTab rows={payments} />;
    case "acts":
      return <ClientActsTab rows={acts} />;
    default:
      return <ClientInfoForm client={client} />;
  }
}

export function ClientCard({
  client,
  contract,
  payments,
  acts,
  activeTab,
}: {
  client: Client;
  contract: Contract | null;
  payments: Payment[];
  acts: Act[];
  activeTab: string;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{client.name}</h1>
        <div className="flex items-center gap-2">
          {client.moeosbbUserId ? <ClientSyncButton clientId={client.id} /> : null}
          <ArchiveButton client={client} />
        </div>
      </div>
      {contract ? null : <ContractWarning />}
      <div className="rounded-xl border border-border bg-card shadow-sm">
        <TabNav clientId={client.id} active={activeTab} />
        <div className="p-6">
          <TabContent
            tab={activeTab}
            client={client}
            contract={contract}
            payments={payments}
            acts={acts}
          />
        </div>
      </div>
    </div>
  );
}

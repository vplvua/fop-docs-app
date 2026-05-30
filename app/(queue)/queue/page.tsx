import { desc, eq, inArray } from "drizzle-orm";
import Link from "next/link";

import { db } from "@/lib/db";
import { clients } from "@/lib/db/schema/clients";
import { contracts } from "@/lib/db/schema/contracts";
import { payments, type Payment } from "@/lib/db/schema/payments";
import { smsPrices, tariffs } from "@/lib/db/schema/tariffs";
import type { Client } from "@/lib/db/schema/clients";
import type { Contract } from "@/lib/db/schema/contracts";
import type { ServiceType } from "@/lib/classification/types";
import { groupByReason } from "@/lib/queue/group";
import { computeMissingFields } from "@/lib/queue/missing-fields";
import { parseReason, reasonLabel } from "@/lib/queue/reasons";
import { resolveAccessPrice, resolveSmsPrice } from "@/lib/tariffs/resolve";

import { QueueCard } from "./queue-card";
import type { ClientCandidate, QueueItemVM } from "./types";

export const metadata = { title: "Черга · ФОП Документи" };

const TABS = [
  { key: "awaiting_review", label: "На апрув" },
  { key: "in_queue", label: "Проблеми класифікації" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function resolveTab(raw: string | undefined): TabKey {
  return raw === "in_queue" ? "in_queue" : "awaiting_review";
}

interface Props {
  searchParams: Promise<{ tab?: string }>;
}

export default async function QueuePage({ searchParams }: Props) {
  const { tab: rawTab } = await searchParams;
  const tab = resolveTab(rawTab);

  const rows = await db
    .select()
    .from(payments)
    .where(eq(payments.status, tab))
    .orderBy(desc(payments.paymentDate))
    .limit(500);

  const vms = await buildViewModels(rows);
  const groups = groupByReason(vms);

  return (
    <div className="space-y-6">
      <h1 className="text-heading-2 text-foreground">Черга</h1>
      <QueueTabs activeTab={tab} />
      {groups.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          {tab === "awaiting_review"
            ? "Немає платежів на апрув"
            : "Немає платежів із проблемами класифікації"}
        </p>
      ) : (
        <div className="space-y-8">
          {groups.map((group) => (
            <section key={group.key} className="space-y-3">
              <h2 className="text-sm font-semibold text-foreground">
                {reasonLabel(group.key)}{" "}
                <span className="font-normal text-muted-foreground">({group.items.length})</span>
              </h2>
              <div className="space-y-3">
                {group.items.map((item) => (
                  <QueueCard key={item.id} item={item} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function QueueTabs({ activeTab }: { activeTab: TabKey }) {
  return (
    <div className="flex gap-1">
      {TABS.map((t) => (
        <Link
          key={t.key}
          href={`/queue?tab=${t.key}`}
          className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
            activeTab === t.key
              ? "border-foreground bg-foreground text-background"
              : "border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}

interface ClientWithContract {
  client: Client;
  contract: Contract | null;
}

/** Collect the active-candidate ids encoded in a multiple_clients reason. */
function candidateIdsOf(reason: string | null): string[] {
  if (!reason?.startsWith("multiple_clients_same_edrpou:")) return [];
  return reason.slice("multiple_clients_same_edrpou:".length).split(",").filter(Boolean);
}

async function buildViewModels(rows: Payment[]): Promise<QueueItemVM[]> {
  const clientIds = [...new Set(rows.map((r) => r.clientId).filter((id): id is string => !!id))];
  const candidateIds = [...new Set(rows.flatMap((r) => candidateIdsOf(r.classificationReason)))];
  const needsTariffs = rows.some((r) => r.classificationReason?.startsWith("amount_mismatch"));
  const needsSmsPrices = rows.some((r) =>
    r.classificationReason?.startsWith("sms_quantity_mismatch"),
  );

  const [clientMap, candidateMap, allTariffs, allSmsPrices] = await Promise.all([
    loadClients(clientIds),
    loadCandidates(candidateIds),
    needsTariffs ? db.select().from(tariffs) : Promise.resolve([]),
    needsSmsPrices ? db.select().from(smsPrices) : Promise.resolve([]),
  ]);

  return rows.map((row) => {
    const { key, detail } = parseReason(row.classificationReason ?? "");
    const linked = row.clientId ? clientMap.get(row.clientId) : undefined;
    const serviceType: ServiceType = row.serviceType === "sms" ? "sms" : "access";

    let unitPrice: string | null = null;
    if (key === "amount_mismatch" && linked) {
      unitPrice = resolveAccessPrice(linked.client, allTariffs, row.paymentDate);
    } else if (key === "sms_quantity_mismatch") {
      unitPrice = resolveSmsPrice(allSmsPrices, row.paymentDate);
    }

    return {
      id: row.id,
      paymentDate: row.paymentDate,
      amount: row.amount,
      purpose: row.purpose,
      payerName: row.payerName,
      payerLegalId: row.payerLegalId,
      payerBankAccount: row.payerBankAccount,
      classificationReason: row.classificationReason,
      reasonKey: key || "other",
      reasonDetail: detail,
      clientId: row.clientId,
      candidates: candidateIdsOf(row.classificationReason)
        .map((id) => candidateMap.get(id))
        .filter((c): c is ClientCandidate => !!c),
      parsedContractNumbers: row.parsedContractNumbers ?? [],
      missingFields:
        key === "client_incomplete" && linked
          ? computeMissingFields(linked.client, linked.contract, serviceType)
          : [],
      unitPrice,
      serviceType: row.serviceType,
    };
  });
}

async function loadClients(ids: string[]): Promise<Map<string, ClientWithContract>> {
  if (ids.length === 0) return new Map();
  const result = await db
    .select()
    .from(clients)
    .leftJoin(contracts, eq(contracts.clientId, clients.id))
    .where(inArray(clients.id, ids));
  return new Map(result.map((r) => [r.clients.id, { client: r.clients, contract: r.contracts }]));
}

async function loadCandidates(ids: string[]): Promise<Map<string, ClientCandidate>> {
  if (ids.length === 0) return new Map();
  const result = await db
    .select({
      id: clients.id,
      name: clients.name,
      moeosbbUserId: clients.moeosbbUserId,
      contractNumber: contracts.number,
    })
    .from(clients)
    .leftJoin(contracts, eq(contracts.clientId, clients.id))
    .where(inArray(clients.id, ids));
  return new Map(result.map((r) => [r.id, r]));
}

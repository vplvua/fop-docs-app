"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";

import type { Client } from "@/lib/db/schema/clients";

const EDO_LABELS: Record<string, string> = {
  dubidoc: "Дубідок",
  vchasno_external: "Вчасно",
};

function EdoBadge({ provider }: { provider: string }) {
  const label = EDO_LABELS[provider] ?? provider;
  return (
    <span className="inline-flex items-center rounded-full border border-border px-2 py-0.5 text-xs font-medium text-muted-foreground">
      {label}
    </span>
  );
}

function ClientRow({ client }: { client: Client }) {
  const router = useRouter();
  const handleClick = useCallback(() => router.push(`/clients/${client.id}`), [router, client.id]);

  return (
    <tr onClick={handleClick} className="cursor-pointer transition-colors hover:bg-accent/50">
      <td className="px-4 py-3 text-sm font-medium text-foreground">{client.name}</td>
      <td className="px-4 py-3 text-sm text-muted-foreground">{client.legalId}</td>
      <td className="px-4 py-3 text-sm text-muted-foreground">{client.apartmentsCount ?? "—"}</td>
      <td className="px-4 py-3">
        <EdoBadge provider={client.edoProvider} />
      </td>
      <td className="px-4 py-3 text-sm text-muted-foreground">{client.moeosbbUserId ?? "—"}</td>
      <td className="px-4 py-3 text-sm text-muted-foreground">
        {client.createdAt.toLocaleDateString("uk-UA")}
      </td>
    </tr>
  );
}

export function ClientsTable({ rows }: { rows: Client[] }) {
  if (rows.length === 0) {
    return <p className="py-12 text-center text-sm text-muted-foreground">Клієнтів не знайдено.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-left">
        <thead className="border-b border-border bg-muted/50">
          <tr>
            <th className="px-4 py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Назва
            </th>
            <th className="px-4 py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              ЄДРПОУ
            </th>
            <th className="px-4 py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Квартири
            </th>
            <th className="px-4 py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              ЕДО
            </th>
            <th className="px-4 py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              MoeOSBB
            </th>
            <th className="px-4 py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Створено
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((c) => (
            <ClientRow key={c.id} client={c} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

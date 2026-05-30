import {
  DataTable,
  DataTableBody,
  DataTableEmpty,
  DataTableHead,
  RowLink,
  Td,
  Th,
} from "@/app/components/data-table";
import type { Client } from "@/lib/db/schema/clients";

export const CLIENTS_COLUMNS = ["Назва", "ЄДРПОУ", "Квартири", "ЕДО", "MoeOSBB", "Створено"];

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

export function ClientsTable({ rows }: { rows: Client[] }) {
  if (rows.length === 0) {
    return <DataTableEmpty>Клієнтів не знайдено.</DataTableEmpty>;
  }

  return (
    <DataTable>
      <DataTableHead>
        <tr>
          {CLIENTS_COLUMNS.map((label) => (
            <Th key={label}>{label}</Th>
          ))}
        </tr>
      </DataTableHead>
      <DataTableBody>
        {rows.map((c) => (
          <RowLink key={c.id} href={`/clients/${c.id}`} label={c.name}>
            <Td className="font-medium">{c.name}</Td>
            <Td className="text-muted-foreground">{c.legalId}</Td>
            <Td className="text-muted-foreground">{c.apartmentsCount ?? "—"}</Td>
            <Td>
              <EdoBadge provider={c.edoProvider} />
            </Td>
            <Td className="text-muted-foreground">{c.moeosbbUserId ?? "—"}</Td>
            <Td className="text-muted-foreground">{c.createdAt.toLocaleDateString("uk-UA")}</Td>
          </RowLink>
        ))}
      </DataTableBody>
    </DataTable>
  );
}

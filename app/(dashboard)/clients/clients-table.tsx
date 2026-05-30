import {
  DataTable,
  DataTableBody,
  DataTableEmpty,
  DataTableHead,
  RowLink,
  SortableHeader,
  Td,
  Th,
} from "@/app/components/data-table";
import type { Client } from "@/lib/db/schema/clients";
import type { SortDir } from "@/lib/data-tables/parse-table-query";

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

export function ClientsTable({ rows, sort, dir }: { rows: Client[]; sort: string; dir: SortDir }) {
  if (rows.length === 0) {
    return <DataTableEmpty>Клієнтів не знайдено.</DataTableEmpty>;
  }

  return (
    <DataTable>
      <DataTableHead>
        <tr>
          <Th>
            <SortableHeader label="Назва" sortKey="name" currentSort={sort} currentDir={dir} />
          </Th>
          <Th>
            <SortableHeader label="ЄДРПОУ" sortKey="legalId" currentSort={sort} currentDir={dir} />
          </Th>
          <Th>
            <SortableHeader
              label="Квартири"
              sortKey="apartmentsCount"
              currentSort={sort}
              currentDir={dir}
            />
          </Th>
          <Th>ЕДО</Th>
          <Th>
            <SortableHeader
              label="MoeOSBB"
              sortKey="moeosbbUserId"
              currentSort={sort}
              currentDir={dir}
            />
          </Th>
          <Th>
            <SortableHeader
              label="Створено"
              sortKey="createdAt"
              currentSort={sort}
              currentDir={dir}
              defaultDir="desc"
            />
          </Th>
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

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
import { computeReadiness, readinessMissingLabels, type Readiness } from "@/lib/clients/readiness";
import type { Client } from "@/lib/db/schema/clients";
import type { Contract } from "@/lib/db/schema/contracts";
import type { SortDir } from "@/lib/data-tables/parse-table-query";
import { cn } from "@/lib/utils";

export const CLIENTS_COLUMNS = ["", "Назва", "ЄДРПОУ", "Квартири", "ЕДО", "MoeOSBB", "Створено"];

/** Drizzle's `clients ⋈ contracts` left-join row shape (1:1 via unique client_id). */
type ClientWithContract = { clients: Client; contracts: Contract | null };

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

const READINESS_META: Record<Readiness["level"], { dot: string; word: string }> = {
  red: { dot: "bg-destructive", word: "Не готовий" },
  yellow: { dot: "bg-readiness-amber", word: "Частково готовий" },
  green: { dot: "bg-success", word: "Готовий" },
};

/**
 * Act-readiness status dot. The hover tooltip (`title`) and screen-reader text
 * list the specific missing items in Ukrainian. `relative z-[1]` lifts the dot
 * above the `RowLink` overlay anchor (z-auto) so its tooltip fires on hover —
 * but stays below the sticky `thead` (z-10) so it doesn't show through the header
 * on scroll.
 */
function ReadinessDot({ level, missing }: Readiness) {
  const meta = READINESS_META[level];
  const labels = readinessMissingLabels(missing);
  const text = labels.length > 0 ? `${meta.word} — не вистачає: ${labels.join(", ")}` : meta.word;
  return (
    <span title={text} className="relative z-[1] inline-flex items-center">
      <span aria-hidden className={cn("inline-block h-2.5 w-2.5 rounded-full", meta.dot)} />
      <span className="sr-only">Готовність: {text}</span>
    </span>
  );
}

function ClientsTableHeaderRow({ sort, dir }: { sort: string; dir: SortDir }) {
  return (
    <tr>
      <Th className="w-0">
        <span className="sr-only">Готовність</span>
      </Th>
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
  );
}

export function ClientsTable({
  rows,
  sort,
  dir,
}: {
  rows: ClientWithContract[];
  sort: string;
  dir: SortDir;
}) {
  if (rows.length === 0) {
    return <DataTableEmpty>Клієнтів не знайдено.</DataTableEmpty>;
  }

  return (
    <DataTable>
      <DataTableHead>
        <ClientsTableHeaderRow sort={sort} dir={dir} />
      </DataTableHead>
      <DataTableBody>
        {rows.map(({ clients: c, contracts: contract }) => (
          <RowLink key={c.id} href={`/clients/${c.id}`} label={c.name}>
            <Td>
              <ReadinessDot {...computeReadiness(c, contract)} />
            </Td>
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

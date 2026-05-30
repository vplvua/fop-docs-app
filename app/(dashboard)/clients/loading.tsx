import { DataTablePage, DataTableSkeleton } from "@/app/components/data-table";

import { CLIENTS_COLUMNS } from "./clients-table";

export default function ClientsLoading() {
  return (
    <DataTablePage
      header={
        <>
          <div className="flex items-center justify-between">
            <h1 className="text-heading-2 text-foreground">Клієнти</h1>
            <div className="h-9 w-36 animate-pulse rounded-md bg-muted" aria-hidden />
          </div>
          <div className="flex flex-wrap items-center gap-3" aria-hidden>
            <div className="h-9 w-64 animate-pulse rounded-md bg-muted" />
            <div className="h-8 w-40 animate-pulse rounded-full bg-muted" />
            <div className="h-8 w-48 animate-pulse rounded-full bg-muted" />
          </div>
        </>
      }
    >
      <DataTableSkeleton columns={CLIENTS_COLUMNS} />
    </DataTablePage>
  );
}

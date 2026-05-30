import { DataTablePage, DataTableSkeleton } from "@/app/components/data-table";

import { ACTS_COLUMNS } from "./page";

export default function ActsLoading() {
  return (
    <DataTablePage
      header={
        <>
          <div className="flex items-center justify-between">
            <h1 className="text-heading-2 text-foreground">Акти</h1>
            <div className="h-9 w-36 animate-pulse rounded-lg bg-muted" aria-hidden />
          </div>
          <div className="flex flex-wrap items-center gap-3" aria-hidden>
            <div className="h-9 w-48 animate-pulse rounded-md bg-muted" />
            <div className="h-8 w-72 animate-pulse rounded-full bg-muted" />
          </div>
        </>
      }
    >
      <DataTableSkeleton columns={ACTS_COLUMNS} />
    </DataTablePage>
  );
}

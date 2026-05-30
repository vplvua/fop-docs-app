import { DataTablePage, DataTableSkeleton } from "@/app/components/data-table";

import { PAYMENTS_COLUMNS } from "./page";

export default function PaymentsLoading() {
  return (
    <DataTablePage
      header={
        <>
          <div className="flex items-center justify-between">
            <h1 className="text-heading-2 text-foreground">Платежі</h1>
            <div className="h-9 w-44 animate-pulse rounded-lg bg-muted" aria-hidden />
          </div>
          <div className="flex flex-wrap items-center gap-3" aria-hidden>
            <div className="h-9 w-64 animate-pulse rounded-md bg-muted" />
            <div className="h-8 w-72 animate-pulse rounded-full bg-muted" />
          </div>
        </>
      }
    >
      <DataTableSkeleton columns={PAYMENTS_COLUMNS} />
    </DataTablePage>
  );
}

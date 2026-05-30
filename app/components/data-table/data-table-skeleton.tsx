import { DataTable, DataTableBody, DataTableHead, Th } from "./data-table";

/**
 * Skeleton table body for route-level `loading.tsx`. Renders the real sticky
 * chrome (same column headers) plus placeholder rows so the layout does not
 * reflow when the data arrives.
 */
export function DataTableSkeleton({ columns, rows = 8 }: { columns: string[]; rows?: number }) {
  const rowKeys = Array.from({ length: rows }, (_, i) => `skeleton-row-${i}`);

  return (
    <DataTable>
      <DataTableHead>
        <tr>
          {columns.map((label) => (
            <Th key={label}>{label}</Th>
          ))}
        </tr>
      </DataTableHead>
      <DataTableBody>
        {rowKeys.map((rowKey) => (
          <tr key={rowKey}>
            {columns.map((label) => (
              <td key={`${rowKey}-${label}`} className="px-4 py-3" aria-hidden>
                <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
              </td>
            ))}
          </tr>
        ))}
      </DataTableBody>
    </DataTable>
  );
}

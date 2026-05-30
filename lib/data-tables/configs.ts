/**
 * Per-table sort allow-lists and default sort/dir. Pure config consumed by the
 * list pages (to parse the URL) and by the services (to build `ORDER BY`).
 *
 * Sort keys are the logical column keys; each service maps them to a concrete
 * Drizzle column against this same allow-list — a raw client string never
 * reaches SQL.
 */
import type { TableQueryConfig } from "./parse-table-query";

/** Clients: MoeOSBB-id first (null ids sink to the bottom), see service. */
export const clientsTableQuery: TableQueryConfig = {
  defaultSort: "moeosbbUserId",
  defaultDir: "asc",
  sortable: ["name", "legalId", "apartmentsCount", "moeosbbUserId", "createdAt"],
};

/** Payments: newest first. */
export const paymentsTableQuery: TableQueryConfig = {
  defaultSort: "paymentDate",
  defaultDir: "desc",
  sortable: ["paymentDate", "amount", "payerName"],
};

/** Acts: newest first, then by number. */
export const actsTableQuery: TableQueryConfig = {
  defaultSort: "actDate",
  defaultDir: "desc",
  sortable: ["actDate", "number", "amount", "serviceType"],
};

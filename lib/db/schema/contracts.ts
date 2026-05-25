import { sql } from "drizzle-orm";
import { boolean, date, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { clients } from "./clients";

export const contracts = pgTable(
  "contracts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "restrict" }),
    number: text("number").notNull(),
    signedDate: date("signed_date", { mode: "string" }).notNull(),
    isStandard: boolean("is_standard").notNull().default(true),
    fileUrl: text("file_url"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [uniqueIndex("contracts_client_id_unique").on(table.clientId)],
);

export type Contract = typeof contracts.$inferSelect;
export type NewContract = typeof contracts.$inferInsert;

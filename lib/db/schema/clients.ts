import { sql } from "drizzle-orm";
import {
  boolean,
  bigint,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const edoProviderEnum = pgEnum("edo_provider", ["dubidoc", "vchasno_external"]);

export const clients = pgTable(
  "clients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    moeosbbUserId: bigint("moeosbb_user_id", { mode: "number" }).unique(),
    name: text("name").notNull(),
    legalId: text("legal_id").notNull(),
    address: text("address").notNull().default(""),
    bankName: text("bank_name"),
    bankAccount: text("bank_account"),
    email: text("email").notNull(),
    apartmentsCount: integer("apartments_count"),
    accessPriceOverride: numeric("access_price_override", { precision: 10, scale: 2 }),
    autoActDisabled: boolean("auto_act_disabled").notNull().default(false),
    edoProvider: edoProviderEnum("edo_provider").notNull().default("dubidoc"),
    lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    index("clients_auto_act_disabled_idx").on(table.autoActDisabled),
    index("clients_legal_id_idx").on(table.legalId),
  ],
);

export type Client = typeof clients.$inferSelect;
export type NewClient = typeof clients.$inferInsert;

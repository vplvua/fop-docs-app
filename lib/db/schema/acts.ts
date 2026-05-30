import { sql } from "drizzle-orm";
import {
  date,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { clients } from "./clients";
import { edoProviderEnum } from "./clients";

export const actStatusEnum = pgEnum("act_status", ["draft", "sent_to_edo", "signed", "deleted"]);

export const billingPeriodEnum = pgEnum("billing_period", ["monthly", "annual"]);

export const acts = pgTable(
  "acts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "restrict" }),
    paymentId: uuid("payment_id").notNull(),
    status: actStatusEnum("status").notNull().default("draft"),
    serviceType: text("service_type").notNull(),
    unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).notNull(),
    quantity: numeric("quantity", { precision: 10, scale: 2 }).notNull(),
    quantityUnit: text("quantity_unit").notNull(),
    // Actual paid total — the act's authoritative sum (D3). For monthly acts it
    // equals unit_price × quantity; for discounted annual acts it does not.
    amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
    billingPeriod: billingPeriodEnum("billing_period").notNull().default("monthly"),
    actDate: date("act_date", { mode: "string" }).notNull(),
    number: text("number").notNull(),
    clientSnapshot: jsonb("client_snapshot").notNull(),
    contractSnapshot: jsonb("contract_snapshot").notNull(),
    // Nullable: backfilled for pre-existing acts during mass regeneration.
    fopSnapshot: jsonb("fop_snapshot"),
    serviceDescription: text("service_description").notNull(),
    edoProvider: edoProviderEnum("edo_provider").notNull(),
    pdfFileUrl: text("pdf_file_url"),
    edoDocId: text("edo_doc_id"),
    edoStatus: text("edo_status"),
    sentToEdoAt: timestamp("sent_to_edo_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    uniqueIndex("acts_client_date_number_unique").on(table.clientId, table.actDate, table.number),
  ],
);

export type Act = typeof acts.$inferSelect;
export type NewAct = typeof acts.$inferInsert;

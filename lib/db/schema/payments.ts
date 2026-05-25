import { sql } from "drizzle-orm";
import {
  index,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  date,
  uuid,
} from "drizzle-orm/pg-core";

export const paymentStatusEnum = pgEnum("payment_status", [
  "received",
  "classified",
  "awaiting_review",
  "in_queue",
  "skipped",
]);

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bankTransactionId: text("bank_transaction_id").notNull().unique(),
    paymentDate: date("payment_date", { mode: "string" }).notNull(),
    amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
    purpose: text("purpose").notNull(),
    payerName: text("payer_name").notNull(),
    payerLegalId: text("payer_legal_id").notNull(),
    payerBankAccount: text("payer_bank_account"),
    rawData: jsonb("raw_data").notNull(),
    status: paymentStatusEnum("status").notNull().default("received"),
    classificationReason: text("classification_reason"),
    parsedContractNumbers: text("parsed_contract_numbers").array(),
    clientId: uuid("client_id"),
    serviceType: text("service_type"),
    unitPrice: numeric("unit_price", { precision: 10, scale: 2 }),
    quantity: numeric("quantity", { precision: 10, scale: 2 }),
    quantityUnit: text("quantity_unit"),
    actId: uuid("act_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    index("payments_status_idx").on(table.status),
    index("payments_payment_date_idx").on(table.paymentDate),
    index("payments_client_id_idx").on(table.clientId),
  ],
);

export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;

import { sql } from "drizzle-orm";
import { date, integer, numeric, pgTable, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const tariffs = pgTable(
  "tariffs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    apartmentsMin: integer("apartments_min").notNull().default(0),
    apartmentsMax: integer("apartments_max"),
    price: numeric("price", { precision: 10, scale: 2 }).notNull(),
    effectiveFrom: date("effective_from", { mode: "string" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    uniqueIndex("tariffs_range_effective_unique").on(
      table.apartmentsMin,
      table.apartmentsMax,
      table.effectiveFrom,
    ),
  ],
);

export type Tariff = typeof tariffs.$inferSelect;
export type NewTariff = typeof tariffs.$inferInsert;

export const smsPrices = pgTable(
  "sms_prices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    price: numeric("price", { precision: 10, scale: 2 }).notNull(),
    effectiveFrom: date("effective_from", { mode: "string" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [uniqueIndex("sms_prices_effective_from_unique").on(table.effectiveFrom)],
);

export type SmsPrice = typeof smsPrices.$inferSelect;
export type NewSmsPrice = typeof smsPrices.$inferInsert;

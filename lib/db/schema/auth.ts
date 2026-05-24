import { sql } from "drizzle-orm";
import { bigserial, boolean, index, inet, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Active admin sessions. Cookie holds the raw token; we store only its
 * HMAC-SHA-256 keyed by `SESSION_SECRET` (see `lib/auth/session.ts`).
 * Rotating `SESSION_SECRET` invalidates every existing session.
 */
export const sessions = pgTable(
  "sessions",
  {
    tokenHash: text("token_hash").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    ip: inet("ip"),
  },
  (table) => [index("sessions_expires_at_idx").on(table.expiresAt)],
);

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;

/**
 * Append-only ledger of sign-in attempts. The rate-limit query (FR-AUTH-05)
 * counts failed rows for an IP within the trailing 60 minutes; successful
 * sign-ins also clear failed rows for that IP to reset the window.
 */
export const loginAttempts = pgTable(
  "login_attempts",
  {
    id: bigserial("id", { mode: "bigint" }).primaryKey(),
    ip: inet("ip").notNull(),
    attemptedAt: timestamp("attempted_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    success: boolean("success").notNull(),
  },
  (table) => [index("login_attempts_ip_attempted_at_idx").on(table.ip, table.attemptedAt.desc())],
);

export type LoginAttempt = typeof loginAttempts.$inferSelect;
export type NewLoginAttempt = typeof loginAttempts.$inferInsert;

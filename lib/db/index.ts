import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import * as schema from "./schema";

if (!process.env.POSTGRES_URL) {
  throw new Error(
    "POSTGRES_URL is not set. Locally: `vercel env pull .env.local --yes`. " +
      "On Vercel: provisioned by the Neon Marketplace integration (ADR D-024).",
  );
}

const sql = neon(process.env.POSTGRES_URL);

// HTTP-fetch driver fits Vercel Fluid Compute well (no stateful connection pool).
// `db.transaction()` is not supported on neon-http — when S6/S8 introduce
// `SELECT FOR UPDATE` workflows, add a sibling `dbPool` export using
// `drizzle-orm/neon-serverless` + `Pool` (websocket) for transactional ops.
export const db = drizzle({ client: sql, schema, casing: "snake_case" });

export type Db = typeof db;
export { schema };

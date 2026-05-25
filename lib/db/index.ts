import { neon, Pool } from "@neondatabase/serverless";
import { drizzle as drizzleHttp } from "drizzle-orm/neon-http";
import { drizzle as drizzleWs } from "drizzle-orm/neon-serverless";

import * as schema from "./schema";

if (!process.env.POSTGRES_URL) {
  throw new Error(
    "POSTGRES_URL is not set. Locally: `vercel env pull .env.local --yes`. " +
      "On Vercel: provisioned by the Neon Marketplace integration (ADR D-024).",
  );
}

const sql = neon(process.env.POSTGRES_URL);

export const db = drizzleHttp({ client: sql, schema, casing: "snake_case" });

const pool = new Pool({ connectionString: process.env.POSTGRES_URL });
export const dbPool = drizzleWs({ client: pool, schema, casing: "snake_case" });

export type Db = typeof db;
export type DbPool = typeof dbPool;
export { schema };

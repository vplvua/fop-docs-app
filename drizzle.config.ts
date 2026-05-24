import { existsSync } from "node:fs";
import { defineConfig } from "drizzle-kit";

if (existsSync(".env.local")) {
  process.loadEnvFile(".env.local");
}

if (!process.env.POSTGRES_URL) {
  throw new Error(
    "POSTGRES_URL is not set. Run `vercel env pull .env.local --yes` first (see AGENTS.md).",
  );
}

export default defineConfig({
  schema: "./lib/db/schema/index.ts",
  out: "./lib/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.POSTGRES_URL,
  },
  strict: true,
  verbose: true,
});

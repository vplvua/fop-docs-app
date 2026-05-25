import type { VercelConfig } from "@vercel/config/v1";

/**
 * Project-level Vercel config (replaces `vercel.json`). Cron handlers are
 * registered here per slice — leave empty in Phase 0 setup, fill in S6
 * (privatbank-poll), S9 (dubidoc-poll), S11 (moeosbb-sync).
 */
export const config: VercelConfig = {
  framework: "nextjs",
  crons: [
    { path: "/api/cron/privatbank-poll", schedule: "0 * * * *" },
    { path: "/api/cron/dubidoc-poll", schedule: "0 */6 * * *" },
  ],
};

export default config;

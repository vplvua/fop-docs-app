import pino from "pino";

/**
 * Structured JSON logger. Redaction list covers every secret referenced by
 * `.env.example` (NFR-SEC-02) plus common HTTP-auth header shapes so any
 * accidental request/response dump stays scrubbed.
 *
 * Log level: `LOG_LEVEL` env if set, otherwise `info` in prod / `debug` in dev.
 */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === "production" ? "info" : "debug"),
  base: { service: "fop-docs-app" },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: [
      "POSTGRES_URL",
      "BLOB_READ_WRITE_TOKEN",
      "PRIVATBANK_TOKEN",
      "DUBIDOC_TOKEN",
      "MOEOSBB_DB_URL",
      "ADMIN_PASSWORD_HASH",
      "SESSION_SECRET",
      "*.password",
      "*.token",
      "*.apiKey",
      "*.authorization",
      'headers["authorization"]',
      'headers["Authorization"]',
      'headers["cookie"]',
      'headers["Cookie"]',
      'request.headers["authorization"]',
      'request.headers["cookie"]',
      'response.headers["set-cookie"]',
    ],
    censor: "[REDACTED]",
  },
});

export type Logger = typeof logger;

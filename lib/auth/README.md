# `lib/auth`

Single-admin auth primitives (S1). Pure modules — no `next/*` imports.
Server actions and `proxy.ts` are responsible for `cookies()`/`redirect()`.

| Module          | Exports                                                                                                                 |
| --------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `password.ts`   | `verifyPassword(password, hash)` — argon2id verify; never throws (returns `false`).                                     |
| `session.ts`    | `createSession`, `validateSession`, `destroySession`, `hashToken`, `deleteExpiredSessions`.                             |
| `rate-limit.ts` | `checkRateLimit`, `recordSuccess`, `recordFailure`, `deleteOldLoginAttempts`, `RATE_LIMIT_MAX_FAILURES/WINDOW_SECONDS`. |
| `cookie.ts`     | `SESSION_COOKIE_NAME`, `SESSION_TTL_SECONDS`, `sessionCookie`, `clearedSessionCookie`.                                  |
| `safe-next.ts`  | `parseSafeNext(value)` — only same-origin leading-slash paths survive.                                                  |
| `index.ts`      | Re-exports.                                                                                                             |

Refs: [`docs/prd.md`](../../docs/prd.md) FR-AUTH-01..06, NFR-SEC-01..04,
[`docs/adr/D-032-auth.md`](../../docs/adr/D-032-auth.md), and
[`openspec/changes/add-auth/`](../../openspec/changes/add-auth/) for the
slice's full context.

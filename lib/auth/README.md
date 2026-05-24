# `lib/auth`

Placeholder. Implemented in **S1 (auth)**.

Will contain: session generate/validate (HMAC), `argon2id` password verify,
`getSession()` server helper, IP-based rate-limit counter (10 attempts / hour),
plus the proxy.ts integration that gates every route except `/login` and
`/api/health`.

Refs: [`docs/prd.md`](../../docs/prd.md) FR-AUTH-01..06, NFR-SEC-01..04,
[ADR D-032](../../docs/adr/D-032-auth.md).

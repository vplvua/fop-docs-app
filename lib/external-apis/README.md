# `lib/external-apis`

Shared shape for outbound HTTP clients. One subfolder per provider, each owns
its own request/response Zod schemas, retry/backoff policy, error mapping, and
auth-token plumbing. Health writes go through `lib/observability`.

Slot-in order:

- `privatbank/` — **S6 (payments-ingest)**, ADR D-020.
- `dubidoc/` — **S9 (edo-dubidoc)**, ADR D-029.
- `moeosbb/` — **S11 (moeosbb-sync)** (MySQL, read-only), ADRs D-004 / D-021.

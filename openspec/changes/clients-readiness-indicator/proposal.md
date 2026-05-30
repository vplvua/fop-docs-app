## Why

From the clients list, the operator cannot tell which clients are ready to have an act generated and which are blocked. The information exists — `checkCompleteness(client, contract, serviceType)` already returns the list of missing fields (email, address, bank_name, bank_account, contract, apartments_count) used by the queue — but it is never surfaced on `/clients`. Today the operator must open each client card to discover a missing contract or empty bank details, which is exactly the kind of gap that silently blocks act creation.

This change adds a **per-row readiness indicator** (🔴 / 🟡 / 🟢) with a tooltip listing what is missing. It is self-contained and independent of the other table changes (it only needs a join to `contracts`), so it can ship on its own; it composes naturally with the new shell but does not depend on pagination/search.

Depends on: nothing hard. Best after `table-layout-shell` so the column lives in the shared table, but functionally independent.

## What Changes

- Add a **readiness column** (a small status dot) to the `/clients` table, computed per row by reusing `lib/classification/check-completeness.ts`.
- The clients query LEFT JOINs `contracts` so each row knows whether a contract exists and which required fields are missing.
- **Three states:**
  - 🔴 **Red** — no contract **OR** a required client field is missing (`email`, `address`, `bank_name`, `bank_account`). The client cannot have an act generated.
  - 🟡 **Yellow** — contract present and all required client fields filled, but an optional/conditional field is missing (`apartments_count`, needed for the access service when there is no price override). Acts may be partially blocked.
  - 🟢 **Green** — everything required to create an act is present.
- A **tooltip** (and accessible label) on the dot lists the specific missing items in Ukrainian (e.g. "Немає договору", "Не заповнено: банк, IBAN").

## Capabilities

### Modified Capabilities

- `clients`: the clients list gains a per-row act-readiness indicator (🔴/🟡/🟢 + tooltip) derived from contract presence and required-field completeness.

## Impact

- **Changed:** `/clients` `page.tsx` query (LEFT JOIN `contracts`, select the fields needed for completeness) and the clients table component (new column + dot + tooltip).
- **New code:** a small pure mapper `lib/clients/readiness.ts` turning a client + contract (+ missing-field list) into `{ level: "red" | "yellow" | "green", missing: string[] }`, reusing `checkCompleteness`; Ukrainian labels for missing items.
- **DB:** no migration; `contracts` has a unique index on `client_id`, so the join is 1:1 and cheap.
- **Tooltip/serviceType note:** a client has no single service type at list level, so readiness evaluates the access-service conditional (`apartments_count`) as the yellow trigger; the design records this choice. Required-field/contract checks are service-independent.
- **Tests:** unit tests for `readiness.ts` — red (no contract / missing required), yellow (complete required, missing apartments_count and no override), green (all present, or access covered by override).
- **Design tokens:** dot colors map to semantic tokens (`semantic-success` / `warning` / `destructive`) per DESIGN.md — no hex.
- **PRD coverage:** supports FR-CLI-09 (clients list) operability; surfaces the same completeness logic the queue uses.

## Real behavior proof

To be captured at implementation time: screenshot of the clients list showing the three dot states with a tooltip expanded, plus a verification note tying each dot to its client's contract/field state.

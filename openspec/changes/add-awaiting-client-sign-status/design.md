# Design — add-awaiting-client-sign-status

## Context

`acts.status` (enum `draft|sent_to_edo|signed|deleted`) is the lifecycle; `acts.edo_status` (`text`) holds the raw DubiDoc string. DubiDoc signs `sequential`: the FOP is the document owner, the client is the sole participant (priority 1). Confirmed raw vocabulary: `new` (just sent) → `waiting_for_contractor_sign` (owner signed, client pending) → `signed`. Only `signed` currently promotes the lifecycle; `new` and `waiting_for_contractor_sign` both rest at `sent_to_edo`, so the card cannot distinguish «чекає мого підпису» from «чекає клієнта».

User decisions: **Variant A** (a first-class enum status). Keep the `sent_to_edo` badge «Відправлено в ЕДО». Dashboard gets a **separate** tile for the new status.

## Decision

### State machine

```
 draft ──send (raw "new")──▶ sent_to_edo ──FOP signs (raw "waiting_for_contractor_sign")──▶ waiting_for_client_sign ──client signs (raw "signed")──▶ signed
   ▲                              │                                         │
   └────── 404 reset ────────────┴──────────── archived → deleted ──────────┘   (refused → edo_status="refused", status unchanged)
```

### Raw → internal mapping (single source of truth)

| DubiDoc response                       | `status`                  | `edo_status`                  |
| -------------------------------------- | ------------------------- | ----------------------------- |
| `status="signed"`                      | `signed`                  | `signed`                      |
| `archived=true`                        | `deleted`                 | `archived`                    |
| `refused=true`                         | _(unchanged)_             | `refused`                     |
| `status="new"`                         | `sent_to_edo`             | `new`                         |
| `status="waiting_for_contractor_sign"` | `waiting_for_client_sign` | `waiting_for_contractor_sign` |
| _anything else_                        | _(unchanged)_             | `<raw>`                       |

`mapDubidocStatus(response, current)` returns the patch `{ status?, edoStatus }`. It is **pure** (no DB), called by both the cron and the manual refresh — killing today's duplicated branching. `status` is only set when it advances; the unknown fallthrough never moves the lifecycle, so unseen future strings stay safely `sent_to_edo`/`waiting_for_client_sign`.

### Why the poll-selection set must widen (the trap)

Polling pre-filters on `status = sent_to_edo`. Once an act becomes `waiting_for_client_sign` it would drop out of the cron and **never reach `signed`**. Fix: a shared constant

```
export const EDO_PENDING_STATUSES = ["sent_to_edo", "waiting_for_client_sign"] as const;
```

used by the cron query, the dashboard-trigger query, and the «show refresh button» UI check. The manual per-act refresh is keyed on `edo_doc_id`, not the set, so it already works.

### Why guards need no change

Edit/delete/cancel-split are **allowlists on `draft`**:

- `isMutableAct(status, provider) = status === "draft" || provider === "vchasno_external"`
- `cancelSplit` blocks if any linked act `status !== "draft"`

`waiting_for_client_sign` is not `draft`, so both keep it locked automatically. (A blocklist keyed on `=== "sent_to_edo"` would have silently leaked; there are none.)

## Alternatives considered

- **Variant B — derive the badge from `(status, edo_status)`**, no enum value. Zero migration, no blast radius, but not filterable/countable and couples UI to a raw DubiDoc string. Rejected because the user wants a filter + a dashboard tile.
- **Separate `new` enum status** distinct from `sent_to_edo`. Rejected: `sent_to_edo` is set the instant we POST and DubiDoc returns `new` simultaneously — they are the same moment, a `new` status would be vestigial.
- **Rename `sent_to_edo` → «Очікує мого підпису».** Deferred: the user kept the existing badge. The dashboard tile labels can disambiguate instead.

## Risks / open points

- **Dashboard label ambiguity.** With both tiles present, the existing `sent_to_edo` counter «Актів очікують підпису» implicitly means «мого підпису». Acceptable for now; sharpen labels if it confuses.
- **Raw vocabulary assumption.** Mapping keys on the literal `waiting_for_contractor_sign`. If DubiDoc varies casing/spelling, the act stays `sent_to_edo` (safe degrade, just no promotion). The generic fallthrough keeps `edo_status` for diagnosis.
- **Enum migration.** `ALTER TYPE … ADD VALUE` is not transactional and irreversible; positioned `BEFORE 'signed'` for logical ordering. Prod Neon branch migrated separately; watch `db:generate` re-emitting the `acts` table (trim + bump journal).

## Context

Three operator-reported defects on the client card, with three independent root causes:

| #   | Symptom                                                | Root cause                                                                                                                                                  |
| --- | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Switching tab (or leaving the page) drops typed input  | Tabs are `<Link ?tab=…>` navigations → form unmounts; no dirty tracking, no `beforeunload`, no link interception                                            |
| 2   | A failed save clears the field the operator just typed | Uncontrolled inputs + **React 19 auto `form.reset()` after a form action** → fields reset to `defaultValue`, which is the **stale DB value**                |
| 3   | Can't add `name` to an imported client without email   | Full-form submit posts empty required fields → server Zod blocks the whole update; `.optional()` never applies because the field is always present-as-empty |

The current stack: plain `<form action={formAction}>` + `useActionState`, uncontrolled
`ClientField` inputs with `defaultValue` from the DB row, server-side Zod in the action,
inline-only error display, and no toast system.

## Goals / Non-Goals

- **Goal:** typed input survives validation errors and tab/page navigation.
- **Goal:** an incomplete client can have any single field edited and saved without being
  forced to fill unrelated required fields.
- **Goal:** clear, layered save feedback (sticky bar + toast + error summary).
- **Non-Goal:** redesigning the tab data model — Платежі/Акти tabs stay server-fetched;
  only the editable info/contract forms change and the tab switch becomes dirty-aware.
- **Non-Goal:** removing server-side validation — the server stays the source of truth;
  client-side validation is additive UX.
- **Non-Goal:** changing create-form (`/clients/new`) required-field semantics — required
  on create is unchanged.

## Decisions

### D1 — react-hook-form + zodResolver (controlled fields)

Convert `client-info-form` and `contract-form` to `useForm({ resolver: zodResolver(schema),
defaultValues, mode: "onTouched" })`, reusing the existing Zod schemas. Controlled fields
mean React's post-action form reset no longer wipes input, validation runs client-side
before any submit, and `formState.isDirty` / `dirtyFields` come for free — these power both
the partial update and the unsaved-changes guard.

`ClientField` is refactored to accept RHF `register`/`control` + `fieldState.error` instead
of `defaultValue` + an `error` string. The visual contract (label, required asterisk, hint,
invalid border, error text, aria wiring) is preserved.

Submission moves from a raw form action to an RHF `handleSubmit` that calls the server
action with a typed payload (still validated server-side). The server action keeps its Zod
parse as the authoritative gate.

### D2 — Partial update: submit only dirty fields; readiness, not blocking, flags gaps

On edit, the payload contains only `dirtyFields`. A field the operator did not touch is
**absent** from the request, so the server leaves it untouched and never validates it. This
makes "add a name to an email-less imported client" work: only `name` is sent, email is
never re-validated.

Empty required fields therefore do not block a save — they simply remain empty, and the
existing **"Client act-readiness indicator"** surfaces that the client cannot yet generate
acts (missing email / legal*id / contract). This decouples \_saving an edit* from _client
completeness_, reusing infrastructure that already exists rather than inventing a new
"incomplete" state.

Non-empty values are still format-validated both client- and server-side (e.g. a malformed
email entered by the operator is rejected with a field error). Clearing an already-set
required field to empty **is allowed** on update (it is a deliberate dirty change); the
readiness indicator turns the client non-ready. See Open Questions.

The server action's field collector changes from
`raw[key] = value ?? (formData.has(key) ? "" : undefined)` (which forces present-as-empty)
to honoring true absence: a key not in the dirty payload is `undefined` → schema `.optional()`
skips it.

### D3 — Unsaved-changes guard (three navigation surfaces)

A shared dirty signal (lifted from the active form into the card via context, or a small
store) drives interception on all three surfaces the operator can leave by:

1. **Tab switch** — `TabNav` links call a guard before navigating; if dirty, open
   `<UnsavedChangesDialog>` ("Внесено зміни. Зберегти / Відхилити / Скасувати"). "Зберегти"
   submits then navigates; "Відхилити" navigates losing changes; "Скасувати" stays.
2. **In-app navigation** (sidebar / other `<Link>`) — App Router has no built-in
   `useBlocker`, so a `useUnsavedChangesGuard` hook intercepts via a capture-phase click
   listener on anchor elements (and `router` push wrapping where feasible), showing the same
   dialog.
3. **Browser unload** (refresh / close / external URL) — a `beforeunload` listener set while
   dirty triggers the native browser confirm (text is not customizable — accepted).

### D4 — Layered save feedback

- **Sticky save-bar** (`<SaveBar>`): rendered while `isDirty`, pinned to the bottom of the
  card content, "Є незбережені зміни [Скасувати] [Зберегти]". "Скасувати" = `form.reset()`
  to the loaded values. This is the always-visible affordance and the primary way the
  operator notices unsaved work on a long form.
- **Toast** via `sonner`: success "Збережено" / error "Не вдалося зберегти" after the server
  action resolves. Adds a new `<Toaster>` in the dashboard layout, themed with DESIGN.md
  tokens (no hex literals). Toast is the ephemeral confirmation; it never replaces inline
  errors.
- **Error summary + focus**: on a (server or client) validation failure, an alert at the top
  of the form ("Виправте N полів") plus programmatic scroll + focus to the first invalid
  field (RHF `setFocus` / `shouldFocusError`), and the field shows a visible invalid border.

### D6 — Two tiers of "required"; the form mirrors the act-readiness set

The domain already has a required-field set for act generation, encoded once in
`checkCompleteness` and surfaced by `computeReadiness` (red dot): `email`, `address`,
`bank_name`, `bank_account`, `contract`. The forms historically asterisked only `name`,
`legal_id`, `email`, so `address` / `bank_name` / `bank_account` were silently optional in
the UI despite being required for an act. This change aligns the form with the domain:

- **Tier-1 (identity, create-blocking):** `name`, `legal_id`, `email`. Unchanged — creation
  is blocked if missing.
- **Tier-2 (act-required, non-blocking):** `address`, `bank_name`, `bank_account`. Marked
  with an asterisk and format-validated when filled, but an empty Tier-2 field **does not
  block** create or a partial edit. The red readiness indicator is the single enforcement
  point (it already lists these via `READINESS_LABELS`: адреса / банк / IBAN). This preserves
  the `/clients/new?…` prefill-from-unmatched-payment flow, where bank/address are often not
  yet known.

The asterisk therefore means "required for act generation", and readiness — not a submit
block — enforces Tier-2. `checkCompleteness` / `computeReadiness` are **unchanged**; only the
form schemas and the create/edit UI gain the asterisk + format-when-filled treatment. `email`
keeps its Tier-1 create-block (its existing behavior), even though it is also in the readiness
set.

### D5 — Server action remains authoritative

Client-side Zod is a UX accelerator only. The server action re-parses the (partial) payload
with the same schema and is the final gate, so a bypassed client never corrupts data. The
action returns a typed result the form maps to toast + (if any) field errors.

## Risks / Trade-offs

- **App Router link interception is best-effort.** There is no official navigation blocker;
  the capture-phase click interceptor covers anchor clicks but not every programmatic
  `router.push`. `beforeunload` is the backstop for the gaps. Accepted; documented in the
  hook.
- **New dependencies** (`react-hook-form`, `@hookform/resolvers`, `sonner`). Justified: both
  card forms need this and more forms will follow; hand-rolling controlled validation +
  dirty tracking is more code and more bugs.
- **Behavior change: clearing a required field on update is allowed.** Mitigated by the
  readiness indicator and the save toast; an accidental clear is visible immediately.
- **Two validation sites** (client + server) can drift. Mitigated by sharing one Zod schema
  for both.

## Migration Plan

Pure front-end + server-action change, no DB migration. Land behind the normal `npm run qa`
gates. Verify manually against the reported scenarios (imported client without email; type +
switch tab; type + leave page; failed save preserves input) and capture the demo recording.

## Open Questions

- Should clearing an already-set **required** field (e.g. wiping a valid email) be allowed
  silently, require an extra confirm, or be blocked? Current decision: allow + flag via
  readiness. Revisit if operators clear fields by accident.
- Should the sticky save-bar also offer a "Зберегти і перейти" affordance inside the
  unsaved-changes dialog, or is dialog "Зберегти" enough? Leaning: dialog is enough.
- What is the "format" rule for the Tier-2 fields? `address` and `bank_name` are likely
  just non-empty free text (presence-when-filled only). `bank_account` (IBAN) could get a
  light UA-IBAN mask, but the prefill scenario shows a 29-char `UA…` value and atypical
  accounts may exist — current lean: **no strict IBAN mask**, accept any non-empty string,
  revisit if malformed IBANs reach acts.

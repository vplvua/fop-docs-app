## Why

The client card (`/clients/[id]`) edit forms have three UX defects that lose operator
work and make saving feel broken:

1. **Unsaved input is silently lost on navigation.** Tabs are `<Link href="?tab=…">`
   navigations, so switching from "Загальна інформація" to "Договір" and back unmounts
   the form and discards everything typed. The same happens when the operator clicks any
   sidebar link or closes the tab. There is no dirty tracking and no warning.

2. **A failed save wipes the fields the operator just typed.** The forms use uncontrolled
   inputs with `defaultValue`, and React 19 automatically calls `form.reset()` after every
   form action. On a validation error the action returns _before_ writing, React resets
   every field back to its `defaultValue` (the **stale DB value**), and the operator's
   freshly typed values vanish — e.g. typing "Коротка назва" with an empty email clears
   the short name and shows "Введіть email" under an untouched field.

3. **A partial edit is impossible for incomplete clients.** The form posts every field on
   every submit, so an empty required field (email / legal_id) always trips server
   validation. An imported client with no email cannot have its `name` added — the whole
   submit fails on email, even though `name` is all the operator wanted to change. The
   schema's `.optional()` is an illusion: full-form submit turns "absent" into
   "present-but-empty".

The root causes are independent: (1) navigation has no dirty guard; (2) React 19 form
reset + DB-sourced `defaultValue`; (3) full-form submit + required-on-update validation.
Inline field errors alone are also too quiet on a long, tabbed form — there is no success
toast, no error summary, and no scroll-to-error.

## What Changes

- **Migrate both client-card forms** (`client-info-form`, `contract-form`) from
  uncontrolled `<form action>` + `defaultValue` to **react-hook-form + `zodResolver`**,
  reusing the existing `updateClientSchema` / contract Zod schemas. Client-side validation
  runs before submit, so a validation failure **never wipes input** — values are controlled
  and survive.
- **Partial update semantics on edit.** Submit only **dirty fields** (`dirtyFields`). An
  empty required field on update no longer blocks the save; non-empty values are still
  format-validated. Client completeness is surfaced by the existing **act-readiness
  indicator**, decoupling "save my edits" from "client is complete".
- **Align the form's required set with the act-readiness rules.** `address`, `bank_name`,
  and `bank_account` (IBAN) become **marked-required** fields in the create and edit forms
  (asterisk + format validation when filled), mirroring what `checkCompleteness` /
  `computeReadiness` already enforce (red dot when any is missing). These are **Tier-2**
  (act-required) fields: they do **not** block client creation or a partial edit when left
  empty — the red readiness indicator flags the gap. This keeps the create-from-payment
  prefill flow working. The existing **Tier-1** identity fields (`name`, `legal_id`,
  `email`) keep their current hard-blocking behavior on create.
- **Unsaved-changes guard** driven by `formState.isDirty`:
  - intercept **tab switches** within the card → confirm "Внесено зміни. Зберегти / Відхилити / Скасувати";
  - intercept **in-app navigation** (sidebar / other `<Link>`) with the same prompt;
  - register a **`beforeunload`** handler for browser refresh / tab close / external nav.
- **Three layers of save feedback:**
  - **Sticky save-bar** that appears while the form is dirty: "Є незбережені зміни
    [Скасувати] [Зберегти]";
  - **toast** on save (success "Збережено" / error "Не вдалося зберегти") via a new
    `sonner` Toaster wired to design-system tokens;
  - **error summary** at the top of the form on validation failure with scroll + focus to
    the first invalid field, plus a visible invalid border on the field.

## Capabilities

### New Capabilities

<!-- none -->

### Modified Capabilities

- `clients`: the client-card edit forms gain controlled validation that preserves input,
  partial-update-on-edit semantics, an unsaved-changes navigation guard, and a sticky
  save-bar + toast + error-summary feedback model. The "Client card with tabs" behavior
  gains the tab-switch dirty guard.

## Impact

- Code:
  - `app/(dashboard)/clients/[id]/client-info-form.tsx`, `contract-form.tsx`,
    `client-field.tsx` — convert to react-hook-form controlled fields + error display.
  - `app/(dashboard)/clients/[id]/tab-nav.tsx`, `client-card.tsx` — dirty-aware tab
    switching + shared dirty context.
  - `app/(dashboard)/clients/actions.ts`, `[id]/contract-actions.ts` — accept and persist
    partial (dirty-only) field sets; relax required-on-update blocking while keeping format
    validation.
  - New small client hook(s): `useUnsavedChangesGuard` (beforeunload + in-app link
    interception) and a `<SaveBar>` / `<UnsavedChangesDialog>` component.
  - New `sonner` `<Toaster>` mounted in the dashboard layout, themed via DESIGN.md tokens.
- Deps: add `react-hook-form`, `@hookform/resolvers`, `sonner` (none currently installed).
- DB: **none** — no schema or migration change.
- External APIs / crons: **none**.
- Validation: `lib/validation/clients.ts` may gain an update variant that distinguishes
  "field absent → leave untouched" from "field present-and-empty → format-check". `address`,
  `bank_name`, `bank_account` move from plain `.optional()` to marked-required (asterisk +
  format-when-filled) without becoming create-blocking; Tier-1 create behavior is unchanged.
- Create form (`/clients/new`) + `app/(dashboard)/clients/new/*`: asterisks on `address`,
  `bank_name`, `bank_account`; no blocking on empty (readiness flags). `checkCompleteness`
  / `computeReadiness` already treat these as required — **no change** to readiness code.

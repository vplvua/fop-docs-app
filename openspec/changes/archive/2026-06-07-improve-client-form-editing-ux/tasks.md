# Tasks

## 1. Dependencies & toast infrastructure

- [x] 1.1 Add `react-hook-form`, `@hookform/resolvers`, `sonner` to `package.json`.
- [x] 1.2 Mount a `sonner` `<Toaster>` in the dashboard layout, themed via DESIGN.md tokens
      (success/error classNames reuse the inline-alert token classes).
- [x] 1.3 Thin `toast` helper wrappers `toastSuccess` / `toastError` (`app/components/toast.ts`).

## 2. Controlled field + form migration (info form)

- [x] 2.1 Added a controlled `RhfField` (`[id]/rhf-field.tsx`) instead of refactoring the shared
      `ClientField` — the latter is still used by the uncontrolled create form, so a new
      component avoids breaking it while giving the same visual contract + invalid border.
- [x] 2.2 Convert `client-info-form.tsx` to `useForm({ resolver: zodResolver(clientCardFormSchema),
defaultValues, mode: "onTouched" })`; submit via `handleSubmit`.
- [x] 2.3 Build the submit payload from `dirtyFields` only (partial update); call `updateClient`
      with the typed `ClientUpdatePayload`.
- [x] 2.4 On success: `toastSuccess`, `reset(values)`; on error: map field errors to `setError`,
      `toastError`, focus the first invalid field.

## 3. Contract form migration

- [x] 3.1 Convert `contract-form.tsx` (create + edit) to RHF via a shared `useContractCardForm`
      hook; the delete-confirm stays on `useActionState`.
- [x] 3.2 Partial-update / dirty-only submit for the edit path; toast + error-summary parity.

## 4. Partial-update server semantics

- [x] 4.1 `updateClient` now takes a typed `ClientUpdatePayload` (id + dirty fields only); an
      absent field stays `undefined` so the schema leaves it untouched.
- [x] 4.2 New `clientUpdateSchema` keeps format validation for non-empty values but never blocks
      on an empty required field (readiness indicator flags incompleteness).
- [x] 4.3 Mirrored in `contract-actions.ts` (`updateContract` takes `ContractUpdatePayload`).
- [x] 4.4 Added `clientUpdateSchema` (server) + `clientCardFormSchema` (client) distinguishing
      "absent → leave" from "present-empty → format-check".

## 4b. Required-field alignment (Tier-2: address / bank / IBAN)

- [x] 4b.1 Required asterisks on `address`, `bank_name`, `bank_account` in the create
      (`/clients/new`) and edit forms.
- [x] 4b.2 Schema format-validates these when filled, non-blocking when empty. No strict IBAN
      mask (non-empty string).
- [x] 4b.3 `checkCompleteness` / `computeReadiness` already flag these — no code change;
      `tests/unit/clients/readiness.test.ts` asserts the red dot for missing bank/address.
- [x] 4b.4 Unit: create succeeds with empty Tier-2 fields; malformed filled value rejected.

## 5. Save-bar

- [x] 5.1 `<SaveBar>` (`[id]/card-form-ui.tsx`): shown while `isDirty`, "Є незбережені зміни"
      with Скасувати (`reset()`) / Зберегти (submit).
- [x] 5.2 Wired into the info + contract forms; sticky, elevated, design-token styled.

## 6. Unsaved-changes navigation guard

- [x] 6.1 `UnsavedChangesProvider` holds the active form's dirty state + submit/reset handle;
      forms register via `useUnsavedChanges`.
- [x] 6.2 `<UnsavedChangesDialog>`: "Внесено зміни." Зберегти / Відхилити / Скасувати.
- [x] 6.3 Tab switches are caught by the same global anchor interceptor (tab links render as
      internal `<a>`), so no `TabNav` change was needed; the card is wrapped in the provider.
- [x] 6.4 `useLeaveGuards`: capture-phase anchor-click interception for in-app `<Link>`
      navigation (sidebar + tabs) + a `beforeunload` listener while dirty.

## 7. Error summary + focus

- [x] 7.1 `FormErrorSummary` top-of-form alert "Виправте N полів" on validation failure.
- [x] 7.2 First invalid field focused (RHF `shouldFocusError` + `setFocus` for server errors);
      visible invalid border via `RhfField`.

## 8. Tests & verification

- [x] 8.1 Unit: `clientCardFormSchema` / dirty-payload semantics — empty form passes (presence
      never blocks), malformed values rejected (`tests/unit/validation/clients.test.ts`).
- [x] 8.2 Unit: `clientUpdateSchema` — partial update succeeds with an empty required field;
      malformed non-empty email/legalId still rejected; contract form schema covered too.
- [ ] 8.3 Component/E2E for the live "input survives / tab-switch dialog / beforeunload" flow —
      deferred: the project unit-tests pure logic only (no `.test.tsx`; E2E is S2+/not yet
      configured). The survival + partial-update guarantees are covered at the schema level (8.1/8.2).
- [ ] 8.4 Manual verification of the four reported scenarios + demo recording (needs the
      operator's dev DB + auth) — pending the user's run before PR/archive.

## 9. Docs

- [x] 9.1 Update `docs/current-state.md` (capability + what changed).
- [x] 9.2 `npm run qa` green (7/7: lint, check:design, format:check, typecheck, test:run, build,
      openspec validate).

## 1. Service-name storage & accessor (lib)

- [x] 1.1 Create `lib/services/schema.ts` — Zod schema `{ access: non-empty trimmed string, sms: non-empty trimmed string }`; export `ServiceNames` type and `SERVICE_NAME_DEFAULTS` (current hardcoded strings) (pure, no Next imports)
- [x] 1.2 Create `lib/services/index.ts` — `getServiceNames()` (returns stored value merged over defaults; defaults when unset) and `setServiceNames()` over `getSettingValue`/`setSettingValue` with key `service_names`, validating via the schema
- [x] 1.3 Add unit tests `tests/unit/services/schema.test.ts` — valid passes; empty/missing field rejected; defaults shape

## 2. Use configured names in description building (lib, pure)

- [x] 2.1 Change `lib/classification/act-stub.ts:buildServiceDescription` to accept the resolved names (`buildServiceDescription(serviceType, names)`) and return `names[serviceType]`; reuse `SERVICE_NAME_DEFAULTS` from `lib/services`
- [x] 2.2 Thread names through `buildActStub` input and `lib/classification/types.ts` (`ClassificationInput`) → `lib/classification/classify.ts` call
- [x] 2.3 Update `tests/unit/classification/act-stub.test.ts` for the new `buildServiceDescription` signature (assert it returns the passed name, and the default when given defaults)

## 3. Wire call sites to fetch names

- [x] 3.1 `lib/classification/run-classification.ts` — fetch `getServiceNames()` in the existing `Promise.all` and pass into `classify` input
- [x] 3.2 `lib/acts/regenerate-all.ts` — fetch `getServiceNames()` once and pass into `regenerateOne`, using it when recomputing `service_description`

## 4. Settings UI — Тарифи (access name)

- [x] 4.1 Add a "Назва послуги (доступ)" editor to `app/(settings)/settings/tariffs/` (form + server action + action-state), reading `getServiceNames().access` and saving via merge (only `access`); follow the existing settings pattern and DESIGN.md tokens
- [x] 4.2 Render the editor section on `tariffs/page.tsx`

## 5. Settings UI — Ціни СМС (sms name)

- [x] 5.1 Add a "Назва послуги (інтернет-розсилка)" editor to `app/(settings)/settings/sms-prices/` (form + server action + action-state), reading `getServiceNames().sms` and saving via merge (only `sms`)
- [x] 5.2 Render the editor section on `sms-prices/page.tsx`

## 6. Docs & quality gate

- [x] 6.1 Note in `docs/operations.md` that editing service names requires re-running «Перегенерувати всі акти» to apply to existing acts
- [x] 6.2 Run `npm run qa` and fix any failures
- [x] 6.3 Capture "Real behavior proof" — edit a name in Settings, regenerate an act, confirm the new name in the PDF (screenshot or verification log)

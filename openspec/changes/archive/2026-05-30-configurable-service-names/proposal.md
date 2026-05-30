## Why

The act's service description text is currently hardcoded in `buildServiceDescription` (`Надання доступу до сервісу "Моє ОСББ" (один календарний місяць)` for access, `Інтернет послуги (розсилка повідомлень)` for sms). Changing the wording requires a code edit + deploy. The admin should be able to edit these names from the Settings UI — next to where the matching prices live (Тарифи for the access service, Ціни СМС for the SMS/internet service).

## What Changes

- Store two configurable service names in the existing key-value `settings` table under key `service_names` = `{ access, sms }`. No new table or migration.
- A typed accessor `getServiceNames()` / `setServiceNames()` that returns the stored values, falling back to the **current hardcoded strings as defaults** when unset — so behaviour is unchanged until the admin edits them.
- `buildServiceDescription` takes the resolved name (stays a pure `lib/` function); both call sites read the names and pass them in:
  - classification (`run-classification.ts` → `classify` → `buildActStub`) at act creation;
  - mass regeneration (`regenerate-all.ts`) when recomputing `service_description`.
- Settings UI: a small "Назва послуги" editor on the **Тарифи** page (edits `service_names.access`) and on the **Ціни СМС** page (edits `service_names.sms`). Each edits only its own field, merging into the `service_names` value without clobbering the other.
- Applying to existing acts: after deploy, running **«Перегенерувати всі акти»** makes existing acts adopt the configured names (regeneration already recomputes `service_description`). No new migration.

## Capabilities

### New Capabilities

<!-- none -->

### Modified Capabilities

- `settings`: new requirement — the admin can edit the two service names (stored under `service_names`), surfaced on the Тарифи and Ціни СМС pages.
- `classification`: act-stub creation derives `service_description` from the configured service name for the `service_type` (default wording when unset), instead of a hardcoded string.
- `acts`: mass regeneration recomputes `service_description` using the configured service name (default wording when unset).

## Impact

- **Code**: new `lib/services/` (Zod schema + `getServiceNames`/`setServiceNames` over `getSettingValue`/`setSettingValue`); `lib/classification/act-stub.ts` (`buildServiceDescription` takes the resolved name; `buildActStub` receives names); `lib/classification/classify.ts` + `lib/classification/types.ts` (thread names through `ClassificationInput`); `lib/classification/run-classification.ts` (fetch `service_names`); `lib/acts/regenerate-all.ts` (fetch + use names).
- **UI**: edit forms + server actions on `app/(settings)/settings/tariffs/` and `app/(settings)/settings/sms-prices/` (page + actions + action-state + form), following the existing settings pattern and DESIGN.md tokens.
- **Data**: new `settings` key `service_names`; no schema/migration change.
- **Operational**: redeploy, then re-run «Перегенерувати всі акти» so existing acts pick up the configured names.
- **Constraints**: `lib/` stays pure (no Next imports); `npm run qa` (D-037) must pass.

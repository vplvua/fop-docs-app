## Context

`buildServiceDescription(serviceType)` in `lib/classification/act-stub.ts` returns hardcoded strings. It is called at act creation (`buildActStub`, reached via `lib/classification/classify.ts` ← `lib/classification/run-classification.ts`) and during mass regeneration (`lib/acts/regenerate-all.ts:regenerateOne`). The result is stored in `acts.service_description` and printed verbatim in the PDF.

Existing infrastructure reused: the generic key-value `settings` table with `getSettingValue` / `setSettingValue` (`lib/settings`), the `lib/requisites` accessor pattern (Zod schema + typed get/set over a settings key), and the settings-page pattern (`page.tsx` + `actions.ts` + `action-state.ts` + form). Constraints: `lib/` must stay pure (no Next imports); `npm run qa` (D-037) must pass.

## Goals / Non-Goals

**Goals:**

- Admin edits the two service names from Settings (access name on Тарифи, sms name on Ціни СМС).
- New and regenerated acts use the configured names; defaults preserve current wording until edited.
- No DB migration; reuse existing settings storage and patterns.

**Non-Goals:**

- Per-client or time-effective service names (single global name per service type).
- Changing the quantity unit (always `шт.`), the amount-in-words, numbering, or any other act field.
- A new top-level settings section — the editors live on the existing Тарифи / Ціни СМС pages.

## Decisions

### D1: Store under one settings key `service_names = { access, sms }`

A single jsonb value keeps the two names together and is read in one fetch. A new `lib/services/` module owns the Zod schema (`{ access: non-empty string, sms: non-empty string }`) and `getServiceNames()` / `setServiceNames()` over `getSettingValue`/`setSettingValue`, mirroring `lib/requisites`. Alternative (two separate keys) rejected — needlessly doubles reads/writes for two always-together values.

### D2: Defaults preserve current behaviour

`getServiceNames()` returns the stored value, or — when the key is unset or a field is missing — the **current hardcoded strings** (`SERVICE_NAME_DEFAULTS`). So until the admin edits anything, acts render exactly as today. The defaults live as exported constants so `buildServiceDescription` and the accessor share one source of truth.

### D3: `buildServiceDescription` stays pure — names are passed in

To keep `lib/` free of DB access inside the pure builder, `buildServiceDescription(serviceType, names)` (or `resolveServiceDescription(serviceType, names)`) takes the resolved `{ access, sms }`. The two call sites fetch the names and pass them:

- `run-classification.ts` fetches `service_names` in the same `Promise.all` that already loads requisites/patterns, threads it through `ClassificationInput` → `classify` → `buildActStub`.
- `regenerate-all.ts` fetches once and passes into `regenerateOne`.

Alternative (make `buildServiceDescription` async and read settings itself) rejected — it would pull DB access into the pure classification core and break the `lib/` purity boundary the project enforces.

### D4: Each page edits only its own field, via merge

The Тарифи form edits `access`; the Ціни СМС form edits `sms`. Each server action reads the current `service_names` (with defaults), overrides its one field, and writes back — so saving one never clobbers the other. Forms follow the existing settings pattern and DESIGN.md tokens. The name editor is a small section added to each existing page (no new route).

### D5: Existing acts adopt names via the existing regeneration

No new mechanism: «Перегенерувати всі акти» already recomputes `service_description`; once it reads the configured names, a re-run applies them. The change is purely "where the string comes from".

## Risks / Trade-offs

- **Regeneration overwrites manual `service_description` edits** → already true today (regeneration recomputes for every act); unchanged by this change. Accepted (few acts, verified by hand).
- **Stale acts until regeneration is re-run** → after deploy + editing names, existing acts keep their old text until «Перегенерувати всі акти» runs. Mitigation: documented operational step; new acts pick up names immediately.
- **Empty/invalid stored value** → Zod schema requires non-empty strings; `getServiceNames` falls back to defaults rather than rendering a blank service line.

## Migration Plan

1. Ship schema + accessor + the two settings editors; wire both call sites.
2. Deploy.
3. (Optional) Edit the names in Settings → Тарифи / Ціни СМС.
4. Run «Перегенерувати всі акти» so existing acts adopt the configured names.

Rollback: revert the deploy; the `service_names` key is additive and ignored by the reverted code (which reads hardcoded strings).

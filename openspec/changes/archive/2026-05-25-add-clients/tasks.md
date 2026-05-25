## 1. Database schema and migration

- [ ] 1.1 Створити `lib/db/schema/clients.ts`: Drizzle `pgEnum('edo_provider', ['dubidoc', 'vchasno_external'])` і таблиця `clients` з полями: `id uuid PK DEFAULT gen_random_uuid()`, `moeosbb_user_id bigint UNIQUE nullable`, `name text NOT NULL`, `legal_id text NOT NULL`, `address text NOT NULL DEFAULT ''`, `bank_name text nullable`, `bank_account text nullable`, `email text NOT NULL`, `apartments_count integer nullable`, `access_price_override numeric(10,2) nullable`, `auto_act_disabled boolean NOT NULL DEFAULT false`, `edo_provider edo_provider NOT NULL DEFAULT 'dubidoc'`, `last_sync_at timestamptz nullable`, `created_at timestamptz NOT NULL DEFAULT now()`, `updated_at timestamptz NOT NULL DEFAULT now()`
- [ ] 1.2 Додати індекси: `clients(auto_act_disabled)` (фільтр Active/Archive), `clients(legal_id)` (пошук)
- [ ] 1.3 Re-export у `lib/db/schema/index.ts`
- [ ] 1.4 `npm run db:generate` → перейменувати на `0002_add_clients.sql`; переглянути SQL
- [ ] 1.5 `npm run db:migrate` — apply на Neon dev branch

## 2. Validation schemas (lib/)

- [ ] 2.1 Створити `lib/validation/clients.ts` з Zod-схемами: `createClientSchema` (name required, legal_id 8 or 10 digits, email RFC, apartments_count optional int ≥ 1, access_price_override optional string matching `^\d+(\.\d{1,2})?$`, edo_provider optional enum, moeosbb_user_id optional int ≥ 1, address optional, bank_name optional, bank_account optional) і `updateClientSchema` (всі поля optional, але ті що присутні — та ж сама валідація)
- [ ] 2.2 `lib/validation/index.ts` — re-export
- [ ] 2.3 Перевірити що `lib/validation/` не імпортує `next/*`

## 3. Server actions

- [ ] 3.1 `app/(dashboard)/clients/actions.ts` — `"use server"` з action `createClient(prev, formData)`: safeParse → INSERT → revalidatePath → redirect `/clients/[id]`. Повертає typed state з field errors
- [ ] 3.2 Action `updateClient(prev, formData)`: safeParse → UPDATE + set `updated_at = now()` → revalidatePath `/clients/[id]`. Повертає success/error state
- [ ] 3.3 Action `archiveClient(id)`: UPDATE `auto_act_disabled = true` → revalidatePath → redirect `/clients`
- [ ] 3.4 Action `activateClient(id)`: UPDATE `auto_act_disabled = false` → revalidatePath → redirect `/clients/[id]`
- [ ] 3.5 Uniqueness check для `moeosbb_user_id`: SELECT count → якщо > 0 повернути field error "Цей ID вже прив'язано до іншого клієнта"; також catch DB unique violation як fallback
- [ ] 3.6 Logging: `logger.info({ event: "client.created", clientId })`, `logger.info({ event: "client.updated", clientId })`, `logger.info({ event: "client.archived", clientId })`
- [ ] 3.7 Helper `getClientIp()` — реюз pattern з S1 auth (або спільна утиліта в `lib/`)

## 4. Client list page

- [ ] 4.1 `app/(dashboard)/clients/page.tsx` — RSC: отримує search params (query, status, source, edo), виконує SELECT з Drizzle WHERE clauses, передає дані в `<ClientsTable />`
- [ ] 4.2 Client components: `<ClientsToolbar />` (search input + filter chips/selects: Active/Archive, Local/MoeOSBB, edo_provider) і `<ClientsTable />` (таблиця з колонками name, legal_id, apartments_count, edo_provider badge, moeosbb_user_id, created_at; row click → `/clients/[id]`)
- [ ] 4.3 Пошук: `name ILIKE '%query%'` OR `legal_id LIKE 'query%'`; debounce у toolbar (URL search params для SSR-compatibility)
- [ ] 4.4 Фільтри через URL search params (`?status=archive&source=moeosbb&edo=vchasno_external`); SSR-friendly — RSC читає params і будує WHERE
- [ ] 4.5 Default: status=active (auto_act_disabled = false); sort by name ASC

## 5. Client create page

- [ ] 5.1 `app/(dashboard)/clients/new/page.tsx` — RSC: читає query params для prefill (`name`, `legal_id`, `bank_account` — FR-CLI-02)
- [ ] 5.2 `<ClientForm />` client component з `useActionState(createClient, initialState)`: поля name, legal_id, email (required); address, bank_name, bank_account, apartments_count, access_price_override, edo_provider (select), moeosbb_user_id (optional); field-level errors від server action
- [ ] 5.3 Warning banner: "Без договору акти не генеруються — додайте договір у вкладці 'Договір'" (FR-CLI-11)
- [ ] 5.4 Усі UI-стрінги українською; tokens з DESIGN.md / shadcn semantic

## 6. Client card page (view/edit + tabs)

- [ ] 6.1 `app/(dashboard)/clients/[id]/page.tsx` — RSC: SELECT client by id; 404 якщо не знайдено
- [ ] 6.2 Tabbed layout: "Загальна інформація" (default), "Договір" (stub), "Платежі" (stub), "Акти" (stub). Tabs через URL hash або query param `?tab=info|contract|payments|acts`
- [ ] 6.3 "Загальна інформація" tab: `<ClientEditForm />` з `useActionState(updateClient, ...)`. Поля grouped by origin: sync-поля (name, legal_id, address, bank_name, bank_account, email) і manual-only поля (apartments_count, access_price_override, auto_act_disabled, edo_provider). Visual origin indicators (🔄 sync / ⚙️ manual only)
- [ ] 6.4 Warning при зміні `edo_provider`: "Зміна каналу ЕДО не переоформлює вже згенеровані акти. Нові акти оформлюватимуться за новим каналом."
- [ ] 6.5 Contract warning banner на всіх tabs: "Без договору акти не генеруються" (FR-CLI-11; у S2 завжди показується)
- [ ] 6.6 Кнопка "Архівувати" (для active clients) / "Активувати" (для archived) у header картки
- [ ] 6.7 "Прив'язати до Моє ОСББ" — inline field для `moeosbb_user_id` якщо NULL
- [ ] 6.8 Stub tabs: "Договір" → "Додайте договір у Slice 3"; "Платежі" → "Платежі з'являться у Slice 6"; "Акти" → "Акти з'являться у Slice 8"

## 7. Navigation

- [ ] 7.1 Додати link "Клієнти" у top-bar `app/(dashboard)/layout.tsx` (поруч з назвою; active-state highlight для `/clients*`)

## 8. Tests

- [ ] 8.1 `tests/unit/validation/clients.test.ts` — create schema: valid (8-digit, 10-digit legal_id), invalid (5 digits, letters, empty); email valid/invalid; apartments_count ≥ 1; access_price_override format
- [ ] 8.2 `tests/unit/validation/clients-update.test.ts` — update schema: all optional; partial update valid; invalid fields still rejected
- [ ] 8.3 Smoke (optional S2): CRUD round-trip on real Neon dev — create → read → update → archive → list filter
- [ ] 8.4 `npm run test:run` — all pass
- [ ] 8.5 `npm run qa` — 6/6 green

## 9. Quality gates + DoD

- [ ] 9.1 `npx openspec validate add-clients --strict` — pass
- [ ] 9.2 Оновити `docs/current-state.md`: S2 → done; next → S3; recent activity entry
- [ ] 9.3 `npx openspec archive add-clients --yes`
- [ ] 9.4 Commit to main

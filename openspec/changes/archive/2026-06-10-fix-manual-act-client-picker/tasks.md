## 1. Свіжість даних і вибірка

- [x] 1.1 Додати `export const dynamic = "force-dynamic"` до `app/(dashboard)/acts/new/page.tsx` і підтвердити в route table білда, що `/acts/new` став `ƒ (Dynamic)`
- [x] 1.2 У `loadContractClients()` виключити архівних клієнтів (`auto_act_disabled = true`), додати `shortName` у select і сортування «коротка назва → повна назва, порожні в кінці»
- [x] 1.3 Додати `shortName` і те саме сортування в `loadEligibleClients()` (`payments/[id]/split/page.tsx`) без виключення архівних; додати `shortName` у лоадер `acts/[id]/edit/page.tsx`

## 2. Лейбл і пошук пікера

- [x] 2.1 Створити чистий модуль `lib/acts/client-label.ts`: тип `ContractClient` + `clientLabel` (коротка назва → «Договір №X» → ЄДРПОУ → «—», без повної назви); реекспортувати тип з `manual-act-form.tsx`
- [x] 2.2 Використати `clientLabel` у всіх трьох місцях рендеру `ClientCombobox` (опція, кнопка, read-only режим) і додати `shortName` у haystack пошуку

## 3. Тести і верифікація

- [x] 3.1 Unit-тести `tests/unit/acts/client-label.test.ts` на весь fallback-ланцюжок лейбла
- [x] 3.2 Прогнати `npm run qa` (lint → format → typecheck → tests → build → openspec validate)
- [x] 3.3 Real-behavior проба: прод-білд локально, GET `/acts/new` з сесією — у HTML є коротка назва клієнта, ЄДРПОУ архівних дублікатів відсутні

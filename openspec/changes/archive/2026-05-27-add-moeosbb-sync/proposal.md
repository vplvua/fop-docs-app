## Why

Клієнти, прив'язані до "Моє ОСББ" через `moeosbb_user_id`, мають реквізити (назва, ЄДРПОУ, адреса, банк, email) які можуть змінюватись у зовнішній системі. Без автоматичного sync адмін мусить вручну стежити за розбіжностями і оновлювати дані — при 600+ клієнтах це нереалістично. S11 — передостанній функціональний зріз перед dashboard polish.

## What Changes

- Додати HTTP client для PHP sync endpoint (`https://moeosbb-sync.moeosbb.com/api.php`) — fetch з Bearer token авторизацією.
- Реалізувати selective merge: оновлювати тільки `name`, `legal_id`, `address`, `bank_name`, `bank_account`, `email`; НЕ торкати `apartments_count`, `access_price_override`, `auto_act_disabled`, `edo_provider`.
- Додати cron handler `app/api/cron/moeosbb-sync/route.ts` з перевіркою `Settings.moeosbb_sync_schedule` (`first` = 1-го числа, `last` = останній день, `manual` = без авто-sync).
- Додати server action `triggerMoeosbbSyncNow` для ручного запуску.
- Додати UI кнопки "Синхронізувати зараз" на дашборді та на картці клієнта.
- Оновлювати `Client.last_sync_at` при кожному sync.
- Записувати `integration_health(service='moeosbb')` при кожному sync (success/error).
- Додати env-змінні `MOEOSBB_SYNC_URL` та `MOEOSBB_SYNC_TOKEN`.

## Capabilities

### New Capabilities

- `moeosbb-sync`: Read-only sync from external MoeOSBB system via PHP endpoint — selective field merge, schedule-based cron, manual trigger, integration health tracking. Covers FR-SYNC-01..06, TC-INTEG-03.

### Modified Capabilities

_(немає змін до spec-level вимог існуючих capabilities)_

## Impact

- **`lib/external-apis/moeosbb/`** — новий HTTP client + sync logic.
- **`app/api/cron/moeosbb-sync/route.ts`** — новий cron handler.
- **`app/(dashboard)/`** — кнопка "Синхронізувати Моє ОСББ зараз" на дашборді.
- **`app/(dashboard)/clients/[id]/`** — кнопка sync на картці клієнта.
- **`vercel.ts`** — новий cron `0 0 * * *` (щоденно, handler перевіряє schedule).
- **`.env.example`** — нові `MOEOSBB_SYNC_URL`, `MOEOSBB_SYNC_TOKEN`.
- **Без нових таблиць/міграцій** — `Client.last_sync_at` вже існує в schema.
- **Без нових npm залежностей** — використовує native `fetch`.

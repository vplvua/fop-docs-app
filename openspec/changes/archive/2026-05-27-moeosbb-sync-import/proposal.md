## Why

Sync з MoeOSBB зараз тільки оновлює існуючих клієнтів з `moeosbb_user_id`. Нових клієнтів з MoeOSBB система ігнорує — адмін мусить створювати їх вручну і прив'язувати `moeosbb_user_id`. При 631 клієнті в MoeOSBB це нереалістично для початкового імпорту та неприйнятно для ongoing роботи: нові клієнти з'являються в MoeOSBB регулярно і мають автоматично потрапляти в систему.

## What Changes

- При sync, remote клієнти без відповідного `moeosbb_user_id` в локальній БД — автоматично створюються як нові Client записи.
- Нові клієнти отримують дефолтні значення для полів, яких немає в MoeOSBB: `edo_provider = "dubidoc"`, `auto_act_disabled = false`, `apartments_count = NULL`.
- `SyncResult` розширюється полем `created` для відображення кількості нових клієнтів.
- UI повідомлення після sync показує скільки клієнтів створено.

## Capabilities

### New Capabilities

_(немає нових capabilities)_

### Modified Capabilities

- `moeosbb-sync`: Requirement "Match by moeosbb_user_id" змінюється — unmatched remote clients тепер створюються замість ігнорування. Додається новий requirement для дефолтних значень нових клієнтів.

## Impact

- **`lib/external-apis/moeosbb/sync.ts`** — додати INSERT для unmatched clients, розширити `SyncResult`.
- **`app/(dashboard)/moeosbb-sync-button.tsx`** — показати `created` у повідомленні.
- **`tests/unit/moeosbb/`** — нові тести для auto-creation.
- Без нових таблиць/міграцій — використовуються існуючі поля `clients`.

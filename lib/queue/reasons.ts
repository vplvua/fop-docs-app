/**
 * Single source of truth for classification-reason parsing and operator-facing
 * copy. Shared by the per-payment classification panel
 * (`app/(dashboard)/payments/[id]/classification-panel.tsx`) and the dedicated
 * queue surface (`app/(queue)/queue/`) so the two never drift.
 *
 * Pure module — no Next.js imports.
 */

export interface ParsedReason {
  key: string;
  detail: string | null;
}

/**
 * Classification reasons are stored as `key` or `key:detail` (e.g.
 * `client_incomplete:email,bank_account` or
 * `multiple_clients_same_edrpou:<id>,<id>`). Split on the first colon only so a
 * detail value containing colons is preserved verbatim.
 */
export function parseReason(raw: string): ParsedReason {
  const idx = raw.indexOf(":");
  if (idx === -1) return { key: raw, detail: null };
  return { key: raw.slice(0, idx), detail: raw.slice(idx + 1) };
}

/** Full guidance sentence shown inside a reason card. */
export const REASON_GUIDANCE: Record<string, string> = {
  no_match:
    "Платіж не вдалося зіставити з жодним клієнтом. Створіть нового клієнта або перевірте ЄДРПОУ.",
  multiple_contracts:
    "У призначенні знайдено кілька номерів договорів. Виправте призначення або оберіть потрібний.",
  multiple_clients_same_edrpou:
    "Кілька активних клієнтів мають цей ЄДРПОУ. Оберіть, до якого привʼязати платіж.",
  ambiguous_client: "Договір знайдено, але ЄДРПОУ платника не збігається з ЄДРПОУ клієнта.",
  client_incomplete: "У клієнта відсутні обовʼязкові поля для генерації акту.",
  amount_mismatch: "Сума платежу не ділиться на тариф без залишку.",
  sms_quantity_mismatch:
    "Не вдалося розпізнати кількість СМС або сума не відповідає кількості × ціна.",
  auto_act_disabled: "Автогенерація актів вимкнена для цього клієнта.",
  external_edo: "Клієнт використовує Вчасно — акт потрібно створити вручну.",
};

/** Short heading used as a group title in the queue. */
export const REASON_LABELS: Record<string, string> = {
  no_match: "Немає збігу",
  multiple_contracts: "Кілька договорів",
  multiple_clients_same_edrpou: "Кілька клієнтів з тим самим ЄДРПОУ",
  ambiguous_client: "Неоднозначний клієнт (застаріле)",
  client_incomplete: "Неповні дані клієнта",
  amount_mismatch: "Сума не відповідає тарифу",
  sms_quantity_mismatch: "Невідповідність кількості СМС",
  auto_act_disabled: "Автогенерація вимкнена",
  external_edo: "Вчасно (ручний workflow)",
};

export function reasonLabel(key: string): string {
  return REASON_LABELS[key] ?? key;
}

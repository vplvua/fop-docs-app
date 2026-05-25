import type { ServiceType } from "./types";

type QuantityResult =
  | { status: "ok"; quantity: string; quantityUnit: string }
  | { status: "mismatch"; reason: string };

export function resolveAccessQuantity(amount: string, unitPrice: string): QuantityResult {
  const a = Number(amount);
  const p = Number(unitPrice);

  if (p <= 0) {
    return { status: "mismatch", reason: "amount_mismatch" };
  }

  const remainder = Math.round((a * 100) % (p * 100)) / 100;
  if (Math.abs(remainder) > 0.001) {
    return { status: "mismatch", reason: "amount_mismatch" };
  }

  const qty = Math.round(a / p);
  return { status: "ok", quantity: String(qty), quantityUnit: "міс." };
}

const SMS_QUANTITY_PATTERNS = [
  /(?:у кількості|кількість[:\s])\s*(\d+)/i,
  /(\d+)\s*(?:шт|sms|смс)/i,
];

export function parseSmsQuantity(purpose: string): number | null {
  for (const pattern of SMS_QUANTITY_PATTERNS) {
    const match = pattern.exec(purpose);
    if (match?.[1]) {
      const num = parseInt(match[1], 10);
      if (num > 0) return num;
    }
  }
  return null;
}

export function resolveSmsQuantity(
  amount: string,
  unitPrice: string,
  purpose: string,
): QuantityResult {
  const parsed = parseSmsQuantity(purpose);
  if (parsed === null) {
    return { status: "mismatch", reason: "sms_quantity_mismatch" };
  }

  const expected = Math.round(parsed * Number(unitPrice) * 100) / 100;
  const actual = Number(amount);

  if (Math.abs(expected - actual) > 0.001) {
    return { status: "mismatch", reason: "sms_quantity_mismatch" };
  }

  return { status: "ok", quantity: String(parsed), quantityUnit: "шт." };
}

export function resolveQuantity(
  serviceType: ServiceType,
  amount: string,
  unitPrice: string,
  purpose: string,
): QuantityResult {
  if (serviceType === "access") {
    return resolveAccessQuantity(amount, unitPrice);
  }
  return resolveSmsQuantity(amount, unitPrice, purpose);
}

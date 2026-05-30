import type { ServiceType } from "./types";

export type BillingPeriod = "monthly" | "annual";

type QuantityResult =
  | { status: "ok"; quantity: string; quantityUnit: string; billingPeriod: BillingPeriod }
  | { status: "mismatch"; reason: string };

export interface AccessQuantityOptions {
  /** Monthly prices a yearly one-shot payment costs (the annual discount). */
  annualPaidMonths: number;
  /** Client has an `access_price_override` — never eligible for the discount. */
  hasOverride: boolean;
}

/**
 * Resolve months + billing period for an access payment. Order (D2):
 *  1. non-override and `amount == unit_price × N` → annual (12 months);
 *  2. clean multiple of `unit_price`, and (override OR quotient < N) → monthly;
 *  3. otherwise mismatch.
 * The annual branch wins over the "N months" reading of the same amount, so a
 * yearly one-shot payment is credited as a full year, not N months.
 */
export function resolveAccessQuantity(
  amount: string,
  unitPrice: string,
  { annualPaidMonths, hasOverride }: AccessQuantityOptions,
): QuantityResult {
  const a = Number(amount);
  const p = Number(unitPrice);

  if (p <= 0) {
    return { status: "mismatch", reason: "amount_mismatch" };
  }

  // 1. One-shot yearly prepayment — only for non-override clients.
  if (!hasOverride) {
    const annual = Math.round(p * annualPaidMonths * 100) / 100;
    if (Math.abs(a - annual) < 0.001) {
      return { status: "ok", quantity: "12", quantityUnit: "міс.", billingPeriod: "annual" };
    }
  }

  // 2. Whole number of months.
  const remainder = Math.round((a * 100) % (p * 100)) / 100;
  if (Math.abs(remainder) > 0.001) {
    return { status: "mismatch", reason: "amount_mismatch" };
  }

  const qty = Math.round(a / p);
  // Non-override amounts at or above the annual price (but ≠ the annual price,
  // already handled above) go to review rather than silent N+ month acts.
  if (!hasOverride && qty >= annualPaidMonths) {
    return { status: "mismatch", reason: "amount_mismatch" };
  }
  return { status: "ok", quantity: String(qty), quantityUnit: "міс.", billingPeriod: "monthly" };
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

  return { status: "ok", quantity: String(parsed), quantityUnit: "шт.", billingPeriod: "monthly" };
}

export function resolveQuantity(
  serviceType: ServiceType,
  amount: string,
  unitPrice: string,
  purpose: string,
  accessOptions: AccessQuantityOptions,
): QuantityResult {
  if (serviceType === "access") {
    return resolveAccessQuantity(amount, unitPrice, accessOptions);
  }
  return resolveSmsQuantity(amount, unitPrice, purpose);
}

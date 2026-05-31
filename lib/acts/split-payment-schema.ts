import { z } from "zod";

/** A positive decimal with up to two fraction digits, stored as a string. */
const positiveDecimal = (label: string) =>
  z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,2})?$/, `Невірний формат: ${label}`)
    .refine((v) => Number(v) > 0, `${label} має бути більше нуля`);

/**
 * One act line of a payment split. Unlike a manual act, no `bankLabel` /
 * `paymentDate` — the split attaches to an existing real payment, so those come
 * from the payment itself. Each line carries its own client and period so a
 * bundle can mix services, clients (two-OSBB transit) and periods (D-042).
 */
export const splitLineSchema = z.object({
  clientId: z.string().uuid(),
  periodYear: z.coerce.number().int().min(2000).max(2100),
  periodMonth: z.coerce.number().int().min(1).max(12),
  serviceType: z.enum(["access", "sms"]),
  quantity: positiveDecimal("Кількість"),
  unitPrice: positiveDecimal("Ціна за одиницю"),
  amount: positiveDecimal("Сума"),
});

/** Payment-split form input: the target payment + one or more act lines. */
export const splitPaymentFormSchema = z.object({
  paymentId: z.string().uuid(),
  lines: z.array(splitLineSchema).min(1, "Потрібен щонайменше один рядок"),
});

export type SplitLineInput = z.input<typeof splitLineSchema>;
export type SplitPaymentFormInput = z.input<typeof splitPaymentFormSchema>;
export type SplitPaymentFormParsed = z.output<typeof splitPaymentFormSchema>;

/** Parse a validated `\d+(\.\d{1,2})?` amount string into integer kopiykas. */
function toKopiykas(amount: string): number {
  const [int, frac = ""] = amount.split(".");
  return Number(int) * 100 + Number((frac + "00").slice(0, 2));
}

/**
 * Whether the line amounts reconcile exactly to the payment amount (D-042 v1:
 * strict equality). Compared in integer kopiykas to avoid float drift.
 */
export function reconcilesExactly(paymentAmount: string, lineAmounts: string[]): boolean {
  const total = lineAmounts.reduce((sum, a) => sum + toKopiykas(a), 0);
  return total === toKopiykas(paymentAmount);
}

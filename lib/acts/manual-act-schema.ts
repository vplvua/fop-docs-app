import { z } from "zod";

/** A non-negative decimal with up to two fraction digits, stored as a string. */
const positiveDecimal = (label: string) =>
  z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,2})?$/, `Невірний формат: ${label}`)
    .refine((v) => Number(v) > 0, `${label} має бути більше нуля`);

/**
 * Manual-act form input. The unit price and amount are validated server-side
 * (never trusted from the client without re-validation); `amount` is stored as
 * entered and is the act's authoritative sum (D4). `bankLabel` and `paymentDate`
 * are optional — an empty string is normalised to absent.
 */
export const manualActFormSchema = z.object({
  clientId: z.string().uuid(),
  periodYear: z.coerce.number().int().min(2000).max(2100),
  periodMonth: z.coerce.number().int().min(1).max(12),
  serviceType: z.enum(["access", "sms"]),
  quantity: positiveDecimal("Кількість"),
  unitPrice: positiveDecimal("Ціна за одиницю"),
  amount: positiveDecimal("Сума"),
  bankLabel: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((v) => (v ? v : null)),
  paymentDate: z
    .string()
    .optional()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), "Невірна дата"),
});

export type ManualActFormInput = z.input<typeof manualActFormSchema>;
export type ManualActFormParsed = z.output<typeof manualActFormSchema>;

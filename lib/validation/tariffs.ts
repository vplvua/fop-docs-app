import { z } from "zod";

export const createTariffSchema = z.object({
  apartmentsMin: z.coerce.number().int("Має бути цілим числом").min(0, "Мінімум 0").optional(),
  apartmentsMax: z.coerce.number().int("Має бути цілим числом").min(1, "Мінімум 1").optional(),
  price: z
    .string()
    .min(1, "Введіть ціну")
    .regex(/^\d+(\.\d{1,2})?$/, "Формат: 200 або 200.00"),
  effectiveFrom: z.string().min(1, "Введіть дату").date("Невірний формат дати"),
});

export type CreateTariffInput = z.infer<typeof createTariffSchema>;

export const createSmsPriceSchema = z.object({
  price: z
    .string()
    .min(1, "Введіть ціну")
    .regex(/^\d+(\.\d{1,2})?$/, "Формат: 1.40"),
  effectiveFrom: z.string().min(1, "Введіть дату").date("Невірний формат дати"),
});

export type CreateSmsPriceInput = z.infer<typeof createSmsPriceSchema>;

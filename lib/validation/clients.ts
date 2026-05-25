import { z } from "zod";

const legalIdSchema = z
  .string()
  .min(1, "Введіть ЄДРПОУ або РНОКПП")
  .regex(/^(\d{8}|\d{10})$/, "ЄДРПОУ (8 цифр) або РНОКПП (10 цифр)");

const emailSchema = z.string().min(1, "Введіть email").email("Невірний формат email");

const edoProviderSchema = z.enum(["dubidoc", "vchasno_external"]).optional();

const apartmentsCountSchema = z.coerce
  .number()
  .int("Має бути цілим числом")
  .min(1, "Мінімум 1")
  .optional();

const accessPriceOverrideSchema = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, "Формат: 123 або 123.45")
  .optional();

const moeosbbUserIdSchema = z.coerce
  .number()
  .int("Має бути цілим числом")
  .min(1, "Мінімум 1")
  .optional();

export const createClientSchema = z.object({
  name: z.string().min(1, "Введіть назву"),
  legalId: legalIdSchema,
  email: emailSchema,
  address: z.string().optional(),
  bankName: z.string().optional(),
  bankAccount: z.string().optional(),
  apartmentsCount: apartmentsCountSchema,
  accessPriceOverride: accessPriceOverrideSchema,
  edoProvider: edoProviderSchema,
  moeosbbUserId: moeosbbUserIdSchema,
  autoActDisabled: z.coerce.boolean().optional(),
});

export type CreateClientInput = z.infer<typeof createClientSchema>;

export const updateClientSchema = z.object({
  id: z.string().uuid("Невірний ID"),
  name: z.string().min(1, "Введіть назву").optional(),
  legalId: legalIdSchema.optional(),
  email: emailSchema.optional(),
  address: z.string().optional(),
  bankName: z.string().optional(),
  bankAccount: z.string().optional(),
  apartmentsCount: apartmentsCountSchema,
  accessPriceOverride: accessPriceOverrideSchema,
  edoProvider: edoProviderSchema,
  moeosbbUserId: moeosbbUserIdSchema,
  autoActDisabled: z.coerce.boolean().optional(),
});

export type UpdateClientInput = z.infer<typeof updateClientSchema>;

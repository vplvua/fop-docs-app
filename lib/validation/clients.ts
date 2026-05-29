import { z } from "zod";

const legalIdSchema = z
  .string()
  .min(1, "Введіть ЄДРПОУ або РНОКПП")
  .regex(/^(\d{8}|\d{10})$/, "ЄДРПОУ (8 цифр) або РНОКПП (10 цифр)");

const emailSchema = z.string().min(1, "Введіть email").email("Невірний формат email");

const edoProviderSchema = z.enum(["dubidoc", "vchasno_external"]).optional();

// An empty string means the user cleared a manual field — coerce it to null so the
// field is wiped, while an absent field (undefined) is left untouched by the action.
const emptyToNull = (v: unknown) => (v === "" ? null : v);

const apartmentsCountSchema = z
  .preprocess(
    emptyToNull,
    z.coerce.number().int("Має бути цілим числом").min(1, "Мінімум 1").nullable(),
  )
  .optional();

const accessPriceOverrideSchema = z
  .preprocess(
    emptyToNull,
    z
      .string()
      .regex(/^\d+(\.\d{1,2})?$/, "Формат: 123 або 123.45")
      .nullable(),
  )
  .optional();

const moeosbbUserIdSchema = z
  .preprocess(
    emptyToNull,
    z.coerce.number().int("Має бути цілим числом").min(1, "Мінімум 1").nullable(),
  )
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

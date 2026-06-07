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

// Operator-curated short name: trim, and treat an empty/whitespace value as a
// cleared field (null) so it never stores blank or whitespace.
const shortNameSchema = z
  .preprocess(
    (v) => (typeof v === "string" ? (v.trim() === "" ? null : v.trim()) : v),
    z.string().nullable(),
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
  shortName: shortNameSchema,
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
  shortName: shortNameSchema,
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

// --- Client-card edit (partial update) ---------------------------------------
//
// The card edit form is "format-when-filled, presence never blocks": an empty
// value is always accepted (clearing a field, or leaving an incomplete client's
// required field empty), while a non-empty value is format-checked. Completeness
// (email / address / bank for act generation) is surfaced by the act-readiness
// indicator, not by blocking the save. Tier-1 create-blocking lives only in
// `createClientSchema`.

const filledEmail = z.union([z.literal(""), z.string().email("Невірний формат email")]).optional();

const filledLegalId = z
  .union([
    z.literal(""),
    z.string().regex(/^(\d{8}|\d{10})$/, "ЄДРПОУ (8 цифр) або РНОКПП (10 цифр)"),
  ])
  .optional();

/** Server schema for the partial client update — relaxes Tier-1 presence. */
export const clientUpdateSchema = z.object({
  id: z.string().uuid("Невірний ID"),
  name: z.string().optional(),
  shortName: shortNameSchema,
  legalId: filledLegalId,
  email: filledEmail,
  address: z.string().optional(),
  bankName: z.string().optional(),
  bankAccount: z.string().optional(),
  apartmentsCount: apartmentsCountSchema,
  accessPriceOverride: accessPriceOverrideSchema,
  edoProvider: edoProviderSchema,
  moeosbbUserId: moeosbbUserIdSchema,
  autoActDisabled: z.coerce.boolean().optional(),
});

export type ClientUpdateInput = z.infer<typeof clientUpdateSchema>;

/** All client-card form field keys (string-valued in the form). */
export const CLIENT_CARD_FIELDS = [
  "name",
  "shortName",
  "legalId",
  "email",
  "address",
  "bankName",
  "bankAccount",
  "apartmentsCount",
  "accessPriceOverride",
  "edoProvider",
  "moeosbbUserId",
] as const;

export type ClientCardField = (typeof CLIENT_CARD_FIELDS)[number];

/**
 * Client-side (react-hook-form) schema for the client card. All values are
 * strings (raw input values), so there is no preprocess/coerce — keeps the RHF
 * input/output types aligned. Mirrors the server format rules; the server's
 * `clientUpdateSchema` stays authoritative.
 */
export const clientCardFormSchema = z.object({
  name: z.string(),
  shortName: z.string(),
  legalId: z.union([
    z.literal(""),
    z.string().regex(/^(\d{8}|\d{10})$/, "ЄДРПОУ (8 цифр) або РНОКПП (10 цифр)"),
  ]),
  email: z.union([z.literal(""), z.string().email("Невірний формат email")]),
  address: z.string(),
  bankName: z.string(),
  bankAccount: z.string(),
  apartmentsCount: z.union([z.literal(""), z.string().regex(/^\d+$/, "Має бути цілим числом")]),
  accessPriceOverride: z.union([
    z.literal(""),
    z.string().regex(/^\d+(\.\d{1,2})?$/, "Формат: 123 або 123.45"),
  ]),
  edoProvider: z.enum(["dubidoc", "vchasno_external"]),
  moeosbbUserId: z.union([z.literal(""), z.string().regex(/^\d+$/, "Має бути цілим числом")]),
});

export type ClientCardFormValues = z.infer<typeof clientCardFormSchema>;

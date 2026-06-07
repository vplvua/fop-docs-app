import { z } from "zod";

export const createContractSchema = z.object({
  clientId: z.string().uuid("Невірний ID клієнта"),
  number: z.string().min(1, "Введіть номер договору"),
  signedDate: z.string().min(1, "Введіть дату підписання").date("Невірний формат дати"),
  isStandard: z.coerce.boolean().optional(),
  fileUrl: z.string().url("Невірний формат URL").optional().or(z.literal("")),
  notes: z.string().optional(),
});

export type CreateContractInput = z.infer<typeof createContractSchema>;

export const updateContractSchema = z.object({
  id: z.string().uuid("Невірний ID"),
  number: z.string().min(1, "Введіть номер договору").optional(),
  signedDate: z.string().min(1, "Введіть дату підписання").date("Невірний формат дати").optional(),
  isStandard: z.coerce.boolean().optional(),
  fileUrl: z.string().url("Невірний формат URL").optional().or(z.literal("")),
  notes: z.string().optional(),
});

export type UpdateContractInput = z.infer<typeof updateContractSchema>;

/**
 * Client-side (react-hook-form) schema for the contract card form. Values are the
 * raw control values (strings + the isStandard checkbox boolean). number and
 * signedDate are required — a contract is meaningless without them — but because
 * the edit form is pre-filled, that requirement never blocks editing a sibling
 * field. The server schemas stay authoritative.
 */
export const contractFormSchema = z.object({
  number: z.string().min(1, "Введіть номер договору"),
  signedDate: z.string().min(1, "Введіть дату підписання").date("Невірний формат дати"),
  isStandard: z.boolean(),
  fileUrl: z.union([z.literal(""), z.string().url("Невірний формат URL")]),
  notes: z.string(),
});

export type ContractFormValues = z.infer<typeof contractFormSchema>;

export const CONTRACT_FORM_FIELDS = [
  "number",
  "signedDate",
  "isStandard",
  "fileUrl",
  "notes",
] as const;

export type ContractFormField = (typeof CONTRACT_FORM_FIELDS)[number];

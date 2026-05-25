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

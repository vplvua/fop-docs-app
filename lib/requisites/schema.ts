import { z } from "zod";

/**
 * FOP (executor) requisites rendered onto every act. Stored verbatim — the
 * template performs no casing or prefixing, so `nameNominative` holds the full
 * requisites-header text (e.g. "ФІЗИЧНА ОСОБА-ПІДПРИЄМЕЦЬ ПАШКО ВАСИЛЬ
 * ТЕОДОЗІЙОВИЧ") and `nameGenitive` the full preamble phrase (e.g. "фізичної
 * особи-підприємця Пашка Василя Теодозійовича").
 */
export const fopRequisitesSchema = z.object({
  nameNominative: z.string().trim().min(1),
  nameGenitive: z.string().trim().min(1),
  ipn: z.string().trim().min(1),
  legalAddress: z.string().trim().min(1),
  bankAccount: z.string().trim().min(1),
  bankName: z.string().trim().min(1),
  taxNote: z.string().trim().min(1),
  phone: z.string().trim().min(1),
  email: z.string().trim().min(1),
  city: z.string().trim().min(1),
});

export type FopRequisites = z.infer<typeof fopRequisitesSchema>;

/** Field order used by the admin form and the requisites table. */
export const FOP_REQUISITES_FIELDS = [
  "nameNominative",
  "nameGenitive",
  "ipn",
  "legalAddress",
  "bankAccount",
  "bankName",
  "taxNote",
  "phone",
  "email",
  "city",
] as const satisfies readonly (keyof FopRequisites)[];

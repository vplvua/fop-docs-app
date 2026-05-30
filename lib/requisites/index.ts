import { getSettingValue, setSettingValue } from "@/lib/settings";

import { fopRequisitesSchema, type FopRequisites } from "./schema";

export { fopRequisitesSchema, FOP_REQUISITES_FIELDS } from "./schema";
export type { FopRequisites } from "./schema";

export const FOP_REQUISITES_KEY = "fop_requisites";

/**
 * Read the executor requisites. Returns `null` when unset. Throws when a stored
 * value is present but fails validation (a data integrity problem that should
 * surface loudly rather than render a malformed act).
 */
export async function getFopRequisites(): Promise<FopRequisites | null> {
  const raw = await getSettingValue<unknown>(FOP_REQUISITES_KEY);
  if (raw == null) return null;
  return fopRequisitesSchema.parse(raw);
}

/** Validate and persist the executor requisites. */
export async function setFopRequisites(value: FopRequisites): Promise<void> {
  const parsed = fopRequisitesSchema.parse(value);
  await setSettingValue(FOP_REQUISITES_KEY, parsed);
}

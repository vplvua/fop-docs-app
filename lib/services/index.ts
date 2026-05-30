import { getSettingValue, setSettingValue } from "@/lib/settings";

import { SERVICE_NAME_DEFAULTS, serviceNamesSchema, type ServiceNames } from "./schema";

export { SERVICE_NAME_DEFAULTS, serviceNamesSchema } from "./schema";
export type { ServiceNames } from "./schema";

export const SERVICE_NAMES_KEY = "service_names";

/**
 * Read the configured act service names. Each stored field that passes
 * validation overrides its default; an unset key or any missing/blank field
 * falls back to {@link SERVICE_NAME_DEFAULTS}, so the act never renders a blank
 * service line and current wording is preserved until the admin edits it.
 */
export async function getServiceNames(): Promise<ServiceNames> {
  const raw = await getSettingValue<unknown>(SERVICE_NAMES_KEY);
  if (raw == null) return { ...SERVICE_NAME_DEFAULTS };
  const parsed = serviceNamesSchema.partial().safeParse(raw);
  if (!parsed.success) return { ...SERVICE_NAME_DEFAULTS };
  return {
    access: parsed.data.access ?? SERVICE_NAME_DEFAULTS.access,
    sms: parsed.data.sms ?? SERVICE_NAME_DEFAULTS.sms,
  };
}

/** Validate and persist both service names. */
export async function setServiceNames(value: ServiceNames): Promise<void> {
  const parsed = serviceNamesSchema.parse(value);
  await setSettingValue(SERVICE_NAMES_KEY, parsed);
}

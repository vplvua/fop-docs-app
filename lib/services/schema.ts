import { z } from "zod";

/**
 * Configurable act service-line names, one per `service_type`. Stored verbatim
 * and printed on the act as the description line — the template performs no
 * casing or prefixing.
 */
export const serviceNamesSchema = z.object({
  access: z.string().trim().min(1),
  sms: z.string().trim().min(1),
});

export type ServiceNames = z.infer<typeof serviceNamesSchema>;

/**
 * Current hardcoded wording, used as defaults until the admin edits the names —
 * so behaviour is unchanged when the `service_names` setting is unset. Single
 * source of truth shared by the accessor and `buildServiceDescription`.
 */
export const SERVICE_NAME_DEFAULTS: ServiceNames = {
  access: 'Надання доступу до сервісу "Моє ОСББ" (один календарний місяць)',
  sms: "Інтернет послуги (розсилка повідомлень)",
};

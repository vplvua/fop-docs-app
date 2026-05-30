import { describe, expect, it } from "vitest";

import {
  SERVICE_NAME_DEFAULTS,
  serviceNamesSchema,
  type ServiceNames,
} from "@/lib/services/schema";

const valid: ServiceNames = {
  access: "Доступ до сервісу Моє ОСББ",
  sms: "Розсилка повідомлень",
};

describe("serviceNamesSchema", () => {
  it("accepts a fully populated object", () => {
    expect(serviceNamesSchema.parse(valid)).toEqual(valid);
  });

  it("trims surrounding whitespace", () => {
    const parsed = serviceNamesSchema.parse({ ...valid, access: "  Доступ  " });
    expect(parsed.access).toBe("Доступ");
  });

  it("rejects a missing field", () => {
    const { sms: _omit, ...rest } = valid;
    void _omit;
    expect(() => serviceNamesSchema.parse(rest)).toThrow();
  });

  it("rejects an empty field", () => {
    expect(() => serviceNamesSchema.parse({ ...valid, access: "" })).toThrow();
  });

  it("rejects a whitespace-only field", () => {
    expect(() => serviceNamesSchema.parse({ ...valid, sms: "   " })).toThrow();
  });
});

describe("SERVICE_NAME_DEFAULTS", () => {
  it("matches the current hardcoded wording", () => {
    expect(SERVICE_NAME_DEFAULTS).toEqual({
      access: 'Надання доступу до сервісу "Моє ОСББ" (один календарний місяць)',
      sms: "Інтернет послуги (розсилка повідомлень)",
    });
  });

  it("passes its own schema", () => {
    expect(serviceNamesSchema.parse(SERVICE_NAME_DEFAULTS)).toEqual(SERVICE_NAME_DEFAULTS);
  });
});

import { describe, expect, it } from "vitest";

import { fopRequisitesSchema, type FopRequisites } from "@/lib/requisites/schema";

const valid: FopRequisites = {
  nameNominative: "ФІЗИЧНА ОСОБА-ПІДПРИЄМЕЦЬ ПАШКО ВАСИЛЬ ТЕОДОЗІЙОВИЧ",
  nameGenitive: "фізичної особи-підприємця Пашка Василя Теодозійовича",
  ipn: "2870111294",
  legalAddress: "79017, м. Львів, вул. Зелена 69А, кв.7",
  bankAccount: "UA963052990000026005031009982",
  bankName: "АТ КБ «Приватбанк»",
  taxNote: "Платник єдиного податку, 3-тя група",
  phone: "067-672-11-27",
  email: "support@moeosbb.com",
  city: "Львів",
};

describe("fopRequisitesSchema", () => {
  it("accepts a fully populated object", () => {
    expect(fopRequisitesSchema.parse(valid)).toEqual(valid);
  });

  it("trims surrounding whitespace", () => {
    const parsed = fopRequisitesSchema.parse({ ...valid, city: "  Львів  " });
    expect(parsed.city).toBe("Львів");
  });

  it("rejects a missing field", () => {
    const { ipn: _omit, ...rest } = valid;
    void _omit;
    expect(() => fopRequisitesSchema.parse(rest)).toThrow();
  });

  it("rejects an empty field", () => {
    expect(() => fopRequisitesSchema.parse({ ...valid, bankAccount: "" })).toThrow();
  });

  it("rejects a whitespace-only field", () => {
    expect(() => fopRequisitesSchema.parse({ ...valid, nameNominative: "   " })).toThrow();
  });
});

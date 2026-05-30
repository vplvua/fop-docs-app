import { describe, expect, it } from "vitest";

import {
  buildClientSnapshot,
  buildContractSnapshot,
  buildServiceDescription,
  generateActNumber,
  lastDayOfMonth,
} from "@/lib/classification/act-stub";
import type { Client } from "@/lib/db/schema/clients";
import type { Contract } from "@/lib/db/schema/contracts";

describe("lastDayOfMonth", () => {
  it("returns 2026-04-30 for April", () => {
    expect(lastDayOfMonth("2026-04-05")).toBe("2026-04-30");
  });

  it("returns 2026-02-28 for non-leap February", () => {
    expect(lastDayOfMonth("2026-02-10")).toBe("2026-02-28");
  });

  it("returns 2024-02-29 for leap February", () => {
    expect(lastDayOfMonth("2024-02-15")).toBe("2024-02-29");
  });

  it("returns 2026-12-31 for December", () => {
    expect(lastDayOfMonth("2026-12-01")).toBe("2026-12-31");
  });

  it("returns 2026-01-31 for January", () => {
    expect(lastDayOfMonth("2026-01-20")).toBe("2026-01-31");
  });
});

describe("generateActNumber", () => {
  it("returns MM/YYYY for the first act in a month", () => {
    expect(generateActNumber(4, 2026, 0)).toBe("04/2026");
  });

  it("returns MM/YYYY/N for subsequent acts", () => {
    expect(generateActNumber(4, 2026, 1)).toBe("04/2026/2");
    expect(generateActNumber(4, 2026, 2)).toBe("04/2026/3");
  });
});

describe("buildServiceDescription", () => {
  it("returns the fixed access description (no embedded quantity)", () => {
    expect(buildServiceDescription("access")).toBe(
      'Надання доступу до сервісу "Моє ОСББ" (один календарний місяць)',
    );
  });

  it("returns the fixed sms description", () => {
    expect(buildServiceDescription("sms")).toBe("Інтернет послуги (розсилка повідомлень)");
  });
});

describe("buildClientSnapshot", () => {
  it("extracts correct fields", () => {
    const client: Client = {
      id: "x",
      moeosbbUserId: null,
      name: "ОСББ Тест",
      legalId: "12345678",
      address: "вул. Тестова 1",
      bankName: "ПриватБанк",
      bankAccount: "UA1234",
      email: "test@test.com",
      apartmentsCount: 50,
      accessPriceOverride: null,
      autoActDisabled: false,
      edoProvider: "dubidoc",
      lastSyncAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const snap = buildClientSnapshot(client);
    expect(snap).toEqual({
      name: "ОСББ Тест",
      legalId: "12345678",
      address: "вул. Тестова 1",
      bankName: "ПриватБанк",
      bankAccount: "UA1234",
      email: "test@test.com",
    });
  });
});

describe("buildContractSnapshot", () => {
  it("extracts correct fields", () => {
    const contract: Contract = {
      id: "x",
      clientId: "y",
      number: "556770",
      signedDate: "2024-01-01",
      isStandard: true,
      fileUrl: null,
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    expect(buildContractSnapshot(contract)).toEqual({
      number: "556770",
      signedDate: "2024-01-01",
    });
  });
});

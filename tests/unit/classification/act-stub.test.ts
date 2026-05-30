import { describe, expect, it } from "vitest";

import {
  buildActStub,
  buildClientSnapshot,
  buildContractSnapshot,
  buildServiceDescription,
  generateActNumber,
  lastDayOfMonth,
} from "@/lib/classification/act-stub";
import type { Client } from "@/lib/db/schema/clients";
import type { Contract } from "@/lib/db/schema/contracts";
import type { Payment } from "@/lib/db/schema/payments";
import { SERVICE_NAME_DEFAULTS } from "@/lib/services/schema";

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
  it("returns the passed access name", () => {
    expect(buildServiceDescription("access", { access: "Доступ X", sms: "СМС Y" })).toBe(
      "Доступ X",
    );
  });

  it("returns the passed sms name", () => {
    expect(buildServiceDescription("sms", { access: "Доступ X", sms: "СМС Y" })).toBe("СМС Y");
  });

  it("returns the default wording when given the defaults", () => {
    expect(buildServiceDescription("access", SERVICE_NAME_DEFAULTS)).toBe(
      'Надання доступу до сервісу "Моє ОСББ" (один календарний місяць)',
    );
    expect(buildServiceDescription("sms", SERVICE_NAME_DEFAULTS)).toBe(
      "Інтернет послуги (розсилка повідомлень)",
    );
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

describe("buildActStub", () => {
  const client = { id: "c1", name: "ОСББ", legalId: "12345678" } as Client;
  const contract = { number: "556770", signedDate: "2024-01-01" } as Contract;

  function build(amount: string, billingPeriod: "monthly" | "annual", quantity: string) {
    const payment = { id: "p1", paymentDate: "2026-04-05", amount } as Payment;
    return buildActStub({
      client,
      contract,
      payment,
      serviceType: "access",
      unitPrice: "200.00",
      quantity,
      billingPeriod,
      existingActCount: 0,
      serviceNames: SERVICE_NAME_DEFAULTS,
    });
  }

  it("carries the paid amount and billing period; quantity unit is always шт.", () => {
    const monthly = build("200.00", "monthly", "1");
    expect(monthly.amount).toBe("200.00");
    expect(monthly.billingPeriod).toBe("monthly");
    expect(monthly.quantityUnit).toBe("шт.");
  });

  it("annual stub keeps the discounted paid amount with quantity 12", () => {
    const annual = build("2000.00", "annual", "12");
    expect(annual.amount).toBe("2000.00");
    expect(annual.billingPeriod).toBe("annual");
    expect(annual.quantity).toBe("12");
    expect(annual.quantityUnit).toBe("шт.");
  });
});

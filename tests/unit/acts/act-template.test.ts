import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ActTemplate } from "@/lib/pdf/act-template";
import type { Act } from "@/lib/db/schema/acts";

const fop = {
  name: "ФОП Тестовий",
  legalId: "1234567890",
  address: "м. Київ, вул. Тестова 1",
  bankAccount: "UA123456789012345678901234567",
  bankName: "ПриватБанк",
};

const act: Act = {
  id: "act-1",
  clientId: "client-1",
  paymentId: "pay-1",
  status: "draft",
  serviceType: "access",
  unitPrice: "200.00",
  quantity: "1",
  quantityUnit: "міс.",
  actDate: "2026-04-30",
  number: "№4",
  clientSnapshot: {
    name: "ОСББ Тест",
    legalId: "12345678",
    address: "вул. Клієнта 5",
    bankName: "Ощадбанк",
    bankAccount: "UA999999999",
    email: "test@test.com",
  },
  contractSnapshot: { number: "556770", signedDate: "2024-01-01" },
  serviceDescription: "Доступ до сервісу за період 1 міс.",
  edoProvider: "dubidoc",
  pdfFileUrl: null,
  edoDocId: null,
  edoStatus: null,
  sentToEdoAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function render(): string {
  return renderToStaticMarkup(createElement(ActTemplate, { act, fop }));
}

describe("ActTemplate", () => {
  it("contains ФОП header", () => {
    const html = render();
    expect(html).toContain("ФОП Тестовий");
    expect(html).toContain("1234567890");
  });

  it("contains client snapshot fields", () => {
    const html = render();
    expect(html).toContain("ОСББ Тест");
    expect(html).toContain("12345678");
    expect(html).toContain("вул. Клієнта 5");
  });

  it("contains contract reference", () => {
    const html = render();
    expect(html).toContain("556770");
    expect(html).toContain("01.01.2024");
  });

  it("contains service table", () => {
    const html = render();
    expect(html).toContain("Доступ до сервісу за період 1 міс.");
    expect(html).toContain("200.00");
  });

  it("contains act date", () => {
    const html = render();
    expect(html).toContain("30.04.2026");
  });

  it("contains act number", () => {
    const html = render();
    expect(html).toContain("№4");
  });
});

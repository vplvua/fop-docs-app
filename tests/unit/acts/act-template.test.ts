import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { Act } from "@/lib/db/schema/acts";
import { ActTemplate } from "@/lib/pdf/act-template";
import type { FopRequisites } from "@/lib/requisites";

const fop: FopRequisites = {
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

const act: Act = {
  id: "act-1",
  clientId: "client-1",
  paymentId: "pay-1",
  status: "draft",
  serviceType: "access",
  unitPrice: "200.00",
  quantity: "1",
  quantityUnit: "шт.",
  actDate: "2026-04-30",
  number: "04/2026",
  clientSnapshot: {
    name: "ОБ'ЄДНАННЯ СПІВВЛАСНИКІВ БАГАТОКВАРТИРНОГО БУДИНКУ «СОБОРНОСТІ 60Д»",
    legalId: "45525794",
    address: "36014 м.Полтава, вул.Соборності, буд. 60Д",
    bankName: 'АТ КБ "Приватбанк"',
    bankAccount: "UA333052990000026000011214071",
    email: "client@osbb.example",
  },
  contractSnapshot: { number: "557259", signedDate: "2024-07-01" },
  fopSnapshot: fop,
  serviceDescription: 'Надання доступу до сервісу "Моє ОСББ" (один календарний місяць)',
  edoProvider: "dubidoc",
  pdfFileUrl: null,
  edoDocId: null,
  edoStatus: null,
  sentToEdoAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function render(overrides: Partial<Act> = {}): string {
  return renderToStaticMarkup(createElement(ActTemplate, { act: { ...act, ...overrides }, fop }));
}

describe("ActTemplate", () => {
  it("renders the two-line heading", () => {
    const html = render();
    expect(html).toContain("АКТ 04/2026");
    expect(html).toContain("здачі-приймання робіт (надання послуг)");
  });

  it("renders the place and date row", () => {
    const html = render();
    expect(html).toContain("Львів");
    expect(html).toContain("30.04.2026");
  });

  it("renders the preamble with client, executor and contract", () => {
    const html = render();
    expect(html).toContain("Ми, представник Замовника");
    expect(html).toContain("«СОБОРНОСТІ 60Д»");
    expect(html).toContain("фізичної особи-підприємця Пашка Василя Теодозійовича");
    expect(html).toContain("557259");
    expect(html).toContain("01.07.2024");
  });

  it("renders the service line with integer quantity and шт.", () => {
    const html = render();
    // NB: react-dom escapes the literal quotes in "Моє ОСББ"; the react-pdf
    // renderer does not — assert on the unambiguous, quote-free fragments.
    expect(html).toContain("Надання доступу до сервісу");
    expect(html).toContain("Моє ОСББ");
    expect(html).toContain("(один календарний місяць)");
    expect(html).toContain("1 шт.");
    expect(html).toContain("200.00 грн.");
  });

  it("renders the total in words and zero VAT", () => {
    const html = render();
    expect(html).toContain("двісті гривень 00 коп.");
    expect(html).toContain("ПДВ 0.00 грн.");
  });

  it("renders the no-claims line", () => {
    expect(render()).toContain("Сторони претензій одна до одної не мають.");
  });

  it("renders the two-column requisites table from the executor snapshot", () => {
    const html = render();
    expect(html).toContain("Від Виконавця");
    expect(html).toContain("Від Замовника");
    expect(html).toContain("ФІЗИЧНА ОСОБА-ПІДПРИЄМЕЦЬ ПАШКО ВАСИЛЬ ТЕОДОЗІЙОВИЧ");
    expect(html).toContain("ІПН 2870111294");
    expect(html).toContain("Платник єдиного податку, 3-тя група");
    expect(html).toContain("support@moeosbb.com");
    expect(html).toContain("Код ЄДРПОУ: 45525794");
  });

  it("renders quantity 12 as an integer", () => {
    expect(render({ quantity: "12", unitPrice: "166.67" })).toContain("12 шт.");
  });

  it("omits the client phone and email (intentional deviation from the sample)", () => {
    const html = render();
    expect(html).not.toContain("client@osbb.example");
  });
});

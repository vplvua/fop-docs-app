import { describe, expect, it } from "vitest";

import { isEditableManualAct, isMutableAct } from "@/lib/acts/manual-act-eligibility";

describe("isMutableAct", () => {
  it("is mutable when draft", () => {
    expect(isMutableAct("draft", "dubidoc")).toBe(true);
  });

  it("is mutable for a vchasno-external act regardless of status", () => {
    expect(isMutableAct("signed", "vchasno_external")).toBe(true);
    expect(isMutableAct("sent_to_edo", "vchasno_external")).toBe(true);
  });

  it("is not mutable once sent to a dubidoc-backed act", () => {
    expect(isMutableAct("sent_to_edo", "dubidoc")).toBe(false);
    expect(isMutableAct("signed", "dubidoc")).toBe(false);
  });
});

describe("isEditableManualAct", () => {
  it("manual + draft → editable", () => {
    expect(
      isEditableManualAct({ source: "manual_external", status: "draft", edoProvider: "dubidoc" }),
    ).toBe(true);
  });

  it("manual + vchasno-external → editable", () => {
    expect(
      isEditableManualAct({
        source: "manual_external",
        status: "signed",
        edoProvider: "vchasno_external",
      }),
    ).toBe(true);
  });

  it("manual + sent_to_edo dubidoc → not editable", () => {
    expect(
      isEditableManualAct({
        source: "manual_external",
        status: "sent_to_edo",
        edoProvider: "dubidoc",
      }),
    ).toBe(false);
  });

  it("automatic (privatbank) act → not editable even when draft", () => {
    expect(
      isEditableManualAct({ source: "privatbank", status: "draft", edoProvider: "dubidoc" }),
    ).toBe(false);
  });

  it("missing backing payment source → not editable", () => {
    expect(isEditableManualAct({ source: null, status: "draft", edoProvider: "dubidoc" })).toBe(
      false,
    );
  });
});

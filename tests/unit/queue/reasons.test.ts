import { describe, expect, it } from "vitest";

import { parseReason, reasonLabel, REASON_GUIDANCE } from "@/lib/queue/reasons";

describe("parseReason", () => {
  it("returns the whole string as key when there is no colon", () => {
    expect(parseReason("no_match")).toEqual({ key: "no_match", detail: null });
  });

  it("splits key and detail on the first colon", () => {
    expect(parseReason("client_incomplete:email,bank_account")).toEqual({
      key: "client_incomplete",
      detail: "email,bank_account",
    });
  });

  it("preserves a detail value containing further colons", () => {
    expect(parseReason("multiple_clients_same_edrpou:a:b:c")).toEqual({
      key: "multiple_clients_same_edrpou",
      detail: "a:b:c",
    });
  });
});

describe("reasonLabel", () => {
  it("maps known reasons to a Ukrainian heading", () => {
    expect(reasonLabel("no_match")).toBe("Немає збігу");
  });

  it("falls back to the raw key for unknown reasons", () => {
    expect(reasonLabel("totally_new_reason")).toBe("totally_new_reason");
  });
});

describe("REASON_GUIDANCE", () => {
  it("has guidance copy for every classifier reason", () => {
    for (const key of [
      "no_match",
      "multiple_contracts",
      "multiple_clients_same_edrpou",
      "ambiguous_client",
      "client_incomplete",
      "amount_mismatch",
      "sms_quantity_mismatch",
      "auto_act_disabled",
      "external_edo",
    ]) {
      expect(REASON_GUIDANCE[key], key).toBeTruthy();
    }
  });
});

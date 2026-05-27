import { describe, expect, it } from "vitest";

import { mapRemoteToClientFields } from "@/lib/external-apis/moeosbb/mapper";
import type { MoeosbbRemoteClient } from "@/lib/external-apis/moeosbb/types";

describe("mapRemoteToClientFields", () => {
  const remote: MoeosbbRemoteClient = {
    id: "42",
    full_name: "ОСББ «Тестове»",
    osbb_zkpo: "12345678",
    legal_address: "вул. Тестова, 1",
    osbb_bank: "ПАТ «ТестБанк»",
    osbb_rr: "UA123456789012345678901234567",
    contract_email: "test@example.com",
  };

  it("maps all fields correctly", () => {
    const result = mapRemoteToClientFields(remote);
    expect(result).toEqual({
      name: "ОСББ «Тестове»",
      legalId: "12345678",
      address: "вул. Тестова, 1",
      bankName: "ПАТ «ТестБанк»",
      bankAccount: "UA123456789012345678901234567",
      email: "test@example.com",
    });
  });

  it("handles empty strings", () => {
    const empty: MoeosbbRemoteClient = {
      id: "1",
      full_name: "",
      osbb_zkpo: "",
      legal_address: "",
      osbb_bank: "",
      osbb_rr: "",
      contract_email: "",
    };
    const result = mapRemoteToClientFields(empty);
    expect(result.name).toBe("");
    expect(result.legalId).toBe("");
    expect(result.address).toBe("");
    expect(result.bankName).toBe("");
    expect(result.bankAccount).toBe("");
    expect(result.email).toBe("");
  });
});

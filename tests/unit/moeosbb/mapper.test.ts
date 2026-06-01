import { describe, expect, it } from "vitest";

import { mapRemoteContractDate, mapRemoteToClientFields } from "@/lib/external-apis/moeosbb/mapper";
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
    createdt: "2023-05-12 10:30:00",
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
      createdt: "",
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

function withCreatedt(createdt: string): MoeosbbRemoteClient {
  return {
    id: "42",
    full_name: "ОСББ «Тестове»",
    osbb_zkpo: "12345678",
    legal_address: "вул. Тестова, 1",
    osbb_bank: "ПАТ «ТестБанк»",
    osbb_rr: "UA123456789012345678901234567",
    contract_email: "test@example.com",
    createdt,
  };
}

describe("mapRemoteContractDate", () => {
  it("extracts the date portion from a MySQL DATETIME", () => {
    expect(mapRemoteContractDate(withCreatedt("2023-05-12 10:30:00"))).toBe("2023-05-12");
  });

  it("passes through a plain ISO DATE", () => {
    expect(mapRemoteContractDate(withCreatedt("2024-01-03"))).toBe("2024-01-03");
  });

  it("reorders DD.MM.YYYY and DD/MM/YYYY", () => {
    expect(mapRemoteContractDate(withCreatedt("12.05.2023"))).toBe("2023-05-12");
    expect(mapRemoteContractDate(withCreatedt("03/01/2024"))).toBe("2024-01-03");
  });

  it("trims surrounding whitespace", () => {
    expect(mapRemoteContractDate(withCreatedt("  2023-05-12  "))).toBe("2023-05-12");
  });

  it("returns null for empty, zero-date, or unparseable input", () => {
    expect(mapRemoteContractDate(withCreatedt(""))).toBeNull();
    expect(mapRemoteContractDate(withCreatedt("0000-00-00"))).toBeNull();
    expect(mapRemoteContractDate(withCreatedt("0000-00-00 00:00:00"))).toBeNull();
    expect(mapRemoteContractDate(withCreatedt("not a date"))).toBeNull();
  });
});

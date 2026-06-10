import { describe, expect, it } from "vitest";

import { clientLabel, type ContractClient } from "@/lib/acts/client-label";

function client(overrides: Partial<ContractClient>): ContractClient {
  return {
    id: "00000000-0000-0000-0000-000000000000",
    name: "",
    shortName: null,
    legalId: "",
    contractNumber: "",
    ...overrides,
  };
}

describe("clientLabel", () => {
  it("uses the curated short name with the EDRPOU suffix", () => {
    expect(clientLabel(client({ shortName: "ОСББ Короткий", legalId: "12345678" }))).toBe(
      "ОСББ Короткий (12345678)",
    );
  });

  it("never shows the full legal name, even when the short name is empty", () => {
    expect(
      clientLabel(
        client({ name: "ОСББ Повна Назва", contractNumber: "556972", legalId: "12345678" }),
      ),
    ).toBe("Договір №556972 (12345678)");
  });

  it("falls back to the contract number when both names are empty", () => {
    expect(clientLabel(client({ contractNumber: "556972", legalId: "12345678" }))).toBe(
      "Договір №556972 (12345678)",
    );
  });

  it("falls back to the EDRPOU alone when there is no contract number", () => {
    expect(clientLabel(client({ legalId: "12345678" }))).toBe("12345678");
  });

  it("renders a dash when every identifier is empty", () => {
    expect(clientLabel(client({}))).toBe("—");
  });

  it("omits the EDRPOU suffix when the EDRPOU is empty", () => {
    expect(clientLabel(client({ contractNumber: "556972" }))).toBe("Договір №556972");
  });
});

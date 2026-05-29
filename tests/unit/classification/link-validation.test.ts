import { describe, expect, it } from "vitest";

import { isClientLinkableToPayment } from "@/lib/classification/link-validation";

describe("isClientLinkableToPayment", () => {
  it("allows a client whose EDRPOU equals the payer EDRPOU", () => {
    expect(
      isClientLinkableToPayment({
        isTransit: false,
        payerLegalId: "45651721",
        clientLegalId: "45651721",
        clientContractNumber: "557352",
        parsedContractNumbers: ["557355"],
      }),
    ).toBe(true);
  });

  it("rejects a client with a different EDRPOU", () => {
    expect(
      isClientLinkableToPayment({
        isTransit: false,
        payerLegalId: "45651721",
        clientLegalId: "99999999",
        clientContractNumber: "557352",
        parsedContractNumbers: ["557352"],
      }),
    ).toBe(false);
  });

  it("allows a transit payment when the client's contract is in the purpose", () => {
    expect(
      isClientLinkableToPayment({
        isTransit: true,
        payerLegalId: "14360570",
        clientLegalId: "45651721",
        clientContractNumber: "556770",
        parsedContractNumbers: ["556770"],
      }),
    ).toBe(true);
  });

  it("rejects a transit payment when the client's contract is not in the purpose", () => {
    expect(
      isClientLinkableToPayment({
        isTransit: true,
        payerLegalId: "14360570",
        clientLegalId: "45651721",
        clientContractNumber: "556770",
        parsedContractNumbers: ["999999"],
      }),
    ).toBe(false);
  });

  it("rejects a transit payment when the client has no contract", () => {
    expect(
      isClientLinkableToPayment({
        isTransit: true,
        payerLegalId: "14360570",
        clientLegalId: "45651721",
        clientContractNumber: null,
        parsedContractNumbers: ["556770"],
      }),
    ).toBe(false);
  });
});

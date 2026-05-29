import { describe, expect, it } from "vitest";

import { matchClient } from "@/lib/classification/match-client";
import type { Client } from "@/lib/db/schema/clients";
import type { Contract } from "@/lib/db/schema/contracts";

function makeClient(overrides: Partial<Client> = {}): Client {
  return {
    id: crypto.randomUUID(),
    moeosbbUserId: null,
    name: "ОСББ Тест",
    legalId: "12345678",
    address: "вул. Тестова 1",
    bankName: "ПриватБанк",
    bankAccount: "UA1234",
    email: "test@example.com",
    apartmentsCount: 50,
    accessPriceOverride: null,
    autoActDisabled: false,
    edoProvider: "dubidoc",
    lastSyncAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeContract(clientId: string, number: string): Contract {
  return {
    id: crypto.randomUUID(),
    clientId,
    number,
    signedDate: "2024-01-01",
    isStandard: true,
    fileUrl: null,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

type ClientWithContract = Client & { contract: Contract | null };

function withContract(client: Client, contractNumber: string): ClientWithContract {
  return Object.assign({}, client, { contract: makeContract(client.id, contractNumber) });
}

function withoutContract(client: Client): ClientWithContract {
  return Object.assign({}, client, { contract: null });
}

describe("matchClient — EDRPOU-first", () => {
  it("matches the single active client by EDRPOU regardless of contract number", () => {
    const client = makeClient({ legalId: "45651721" });
    const clients = [withContract(client, "557352")];
    // payer wrote the wrong contract number — it must be ignored
    const result = matchClient(["557355"], "45651721", clients, []);
    expect(result).toEqual({ status: "matched", client: clients[0] });
  });

  it("ignores archived duplicates and matches the active client", () => {
    const active = withContract(makeClient({ legalId: "45651721" }), "557352");
    const archived = withContract(
      makeClient({ legalId: "45651721", autoActDisabled: true }),
      "557355",
    );
    const result = matchClient(["557355"], "45651721", [archived, active], []);
    expect(result).toEqual({ status: "matched", client: active });
  });

  it("returns no_match when no client has the payer EDRPOU", () => {
    const clients = [withContract(makeClient({ legalId: "12345678" }), "556770")];
    const result = matchClient(["556770"], "99999999", clients, []);
    expect(result.status).toBe("in_queue");
    if (result.status === "in_queue") expect(result.reason).toBe("no_match");
  });

  it("discriminates several active clients by contract number", () => {
    const a = withContract(makeClient({ legalId: "45651721" }), "557352");
    const b = withContract(makeClient({ legalId: "45651721" }), "557399");
    const result = matchClient(["557399"], "45651721", [a, b], []);
    expect(result).toEqual({ status: "matched", client: b });
  });

  it("routes to multiple_clients_same_edrpou when contract does not resolve", () => {
    const a = withContract(makeClient({ legalId: "45651721" }), "557352");
    const b = withContract(makeClient({ legalId: "45651721" }), "557399");
    const result = matchClient([], "45651721", [a, b], []);
    expect(result.status).toBe("awaiting_review");
    if (result.status === "awaiting_review") {
      expect(result.reason).toBe("multiple_clients_same_edrpou");
      expect(result.clientId).toBeNull();
      expect(result.candidateClientIds.toSorted()).toEqual([a.id, b.id].toSorted());
    }
  });

  it("returns multiple_contracts when contract is the discriminator and >1 numbers found", () => {
    const a = withContract(makeClient({ legalId: "45651721" }), "557352");
    const b = withContract(makeClient({ legalId: "45651721" }), "557399");
    const result = matchClient(["557352", "557399"], "45651721", [a, b], []);
    expect(result.status).toBe("in_queue");
    if (result.status === "in_queue") expect(result.reason).toContain("multiple_contracts");
  });
});

describe("matchClient — archived & transit", () => {
  it("returns matched archived client when it is the only one for the EDRPOU", () => {
    const archived = withContract(
      makeClient({ legalId: "12345678", autoActDisabled: true }),
      "556770",
    );
    const result = matchClient([], "12345678", [archived], []);
    expect(result).toEqual({ status: "matched", client: archived });
  });

  it("routes to auto_act_disabled when only several archived clients share the EDRPOU", () => {
    const a = withContract(makeClient({ legalId: "12345678", autoActDisabled: true }), "556770");
    const b = withContract(makeClient({ legalId: "12345678", autoActDisabled: true }), "556771");
    const result = matchClient([], "12345678", [a, b], []);
    expect(result.status).toBe("awaiting_review");
    if (result.status === "awaiting_review") {
      expect(result.reason).toBe("auto_act_disabled");
      expect(result.clientId).toBeNull();
    }
  });

  it("matches transit payment by contract among active clients", () => {
    const client = withContract(makeClient({ legalId: "12345678" }), "556770");
    const result = matchClient(["556770"], "14360570", [client], ["14360570"]);
    expect(result).toEqual({ status: "matched", client });
  });

  it("returns no_match for transit payment with no contract match", () => {
    const client = withoutContract(makeClient({ legalId: "12345678" }));
    const result = matchClient([], "14360570", [client], ["14360570"]);
    expect(result.status).toBe("in_queue");
    if (result.status === "in_queue") expect(result.reason).toBe("no_match");
  });
});

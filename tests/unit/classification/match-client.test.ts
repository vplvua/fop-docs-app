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

describe("matchClient", () => {
  it("matches by contract number + legal_id", () => {
    const client = makeClient({ legalId: "12345678" });
    const clients = [withContract(client, "556770")];
    const result = matchClient(["556770"], "12345678", clients, []);
    expect(result).toEqual({ status: "matched", client: clients[0] });
  });

  it("returns ambiguous_client when contract matches but legal_id differs", () => {
    const client = makeClient({ legalId: "12345678" });
    const clients = [withContract(client, "556770")];
    const result = matchClient(["556770"], "99999999", clients, []);
    expect(result.status).toBe("in_queue");
    if (result.status === "in_queue") {
      expect(result.reason).toBe("ambiguous_client");
    }
  });

  it("falls back to legal_id when no contract matches", () => {
    const client = makeClient({ legalId: "12345678" });
    const clients = [withoutContract(client)];
    const result = matchClient([], "12345678", clients, []);
    expect(result).toEqual({ status: "matched", client: clients[0] });
  });

  it("returns no_match when nothing matches", () => {
    const client = makeClient({ legalId: "12345678" });
    const clients = [withContract(client, "556770")];
    const result = matchClient([], "99999999", clients, []);
    expect(result.status).toBe("in_queue");
    if (result.status === "in_queue") {
      expect(result.reason).toBe("no_match");
    }
  });

  it("bypasses legal_id check for transit EDRPOU", () => {
    const client = makeClient({ legalId: "12345678" });
    const clients = [withContract(client, "556770")];
    const result = matchClient(["556770"], "14360570", clients, ["14360570"]);
    expect(result).toEqual({ status: "matched", client: clients[0] });
  });

  it("returns no_match for transit EDRPOU with no contract match", () => {
    const client = makeClient({ legalId: "12345678" });
    const clients = [withContract(client, "556770")];
    const result = matchClient([], "14360570", clients, ["14360570"]);
    expect(result.status).toBe("in_queue");
    if (result.status === "in_queue") {
      expect(result.reason).toBe("no_match");
    }
  });
});

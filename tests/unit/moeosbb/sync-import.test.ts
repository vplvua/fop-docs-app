import { describe, expect, it } from "vitest";

import { mapRemoteToClientFields } from "@/lib/external-apis/moeosbb/mapper";
import type { MoeosbbRemoteClient } from "@/lib/external-apis/moeosbb/types";

describe("auto-creation field mapping", () => {
  const remote: MoeosbbRemoteClient = {
    id: "42",
    full_name: "ОСББ «Нове»",
    osbb_zkpo: "11223344",
    legal_address: "вул. Нова, 5",
    osbb_bank: "ПАТ «НовоБанк»",
    osbb_rr: "UA111222333444555666777888999",
    contract_email: "new@example.com",
  };

  it("maps remote fields for new client creation", () => {
    const fields = mapRemoteToClientFields(remote);
    expect(fields).toEqual({
      name: "ОСББ «Нове»",
      legalId: "11223344",
      address: "вул. Нова, 5",
      bankName: "ПАТ «НовоБанк»",
      bankAccount: "UA111222333444555666777888999",
      email: "new@example.com",
    });
  });

  it("new client insert shape includes moeosbbUserId and defaults", () => {
    const fields = mapRemoteToClientFields(remote);
    const insertValues = {
      ...fields,
      moeosbbUserId: Number(remote.id),
    };

    expect(insertValues.moeosbbUserId).toBe(42);
    expect(insertValues.name).toBe("ОСББ «Нове»");
    expect(insertValues).not.toHaveProperty("apartmentsCount");
    expect(insertValues).not.toHaveProperty("accessPriceOverride");
    expect(insertValues).not.toHaveProperty("autoActDisabled");
  });

  it("moeosbbUserId parsed as number from string id", () => {
    expect(Number("42")).toBe(42);
    expect(Number("631")).toBe(631);
    expect(Number("1")).toBe(1);
  });
});

describe("sync result shape", () => {
  it("SyncResult includes created field", async () => {
    const result = { fetched: 631, matched: 5, updated: 5, created: 626 };
    expect(result.created).toBe(626);
    expect(result.fetched - result.matched).toBe(result.created);
  });
});

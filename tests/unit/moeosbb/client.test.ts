// @vitest-environment node
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchMoeosbbClients } from "@/lib/external-apis/moeosbb/client";
import { MoeosbbAuthError } from "@/lib/external-apis/moeosbb/types";

import { moeosbbHandlers, SYNC_URL } from "../../mocks/handlers/moeosbb";

const server = setupServer(...moeosbbHandlers);

beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
});
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});

describe("fetchMoeosbbClients", () => {
  beforeEach(() => {
    vi.stubEnv("MOEOSBB_SYNC_URL", SYNC_URL);
    vi.stubEnv("MOEOSBB_SYNC_TOKEN", "test-token");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns clients on success", async () => {
    const clients = await fetchMoeosbbClients();
    expect(clients).toHaveLength(2);
    expect(clients[0]?.full_name).toBe("ОСББ «Тестове»");
    expect(clients[1]?.osbb_zkpo).toBe("87654321");
  });

  it("throws MoeosbbAuthError on 401", async () => {
    vi.stubEnv("MOEOSBB_SYNC_TOKEN", "wrong-token");
    server.use(
      http.get(SYNC_URL, () => HttpResponse.json({ error: "Unauthorized" }, { status: 401 })),
    );
    await expect(fetchMoeosbbClients()).rejects.toThrow(MoeosbbAuthError);
  });

  it("throws on invalid response shape", async () => {
    server.use(http.get(SYNC_URL, () => HttpResponse.json({ ok: false })));
    await expect(fetchMoeosbbClients()).rejects.toThrow();
  });

  it("throws when env vars are missing", async () => {
    vi.stubEnv("MOEOSBB_SYNC_URL", "");
    await expect(fetchMoeosbbClients()).rejects.toThrow("MOEOSBB_SYNC_URL");
  });
});

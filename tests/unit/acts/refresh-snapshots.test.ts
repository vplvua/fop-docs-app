import { beforeEach, describe, expect, it, vi } from "vitest";

// `.limit(1)` returns the next queued result array; call order is
// act → client → contract (the two latter are built left-to-right in Promise.all).
const mockLimitQueue = { rows: [] as unknown[][] };
const mockSetSpy = vi.fn();

vi.mock("@/lib/db", () => {
  const chain = {
    select: vi.fn(),
    from: vi.fn(),
    where: vi.fn(),
    limit: vi.fn(),
    update: vi.fn(),
    set: vi.fn(),
  };
  for (const fn of Object.values(chain)) {
    fn.mockImplementation(() => chain);
  }
  chain.limit.mockImplementation(() => mockLimitQueue.rows.shift() ?? []);
  chain.set.mockImplementation((value: unknown) => {
    mockSetSpy(value);
    return chain;
  });
  return { db: chain };
});

import { refreshActSnapshots } from "@/lib/acts/refresh-snapshots";

const client = {
  id: "client-1",
  name: 'ОБ\'ЄДНАННЯ СПІВВЛАСНИКІВ БАГАТОКВАРТИРНОГО БУДИНКУ "ШУМНА 22"',
  shortName: "ОСББ ШУМНА 22",
  legalId: "44843969",
  address: "88000, м. Ужгород, вул. Шумна, буд. 22",
  bankName: 'АТ КБ "ПриватБанк"',
  bankAccount: "UA813052990000026004043610489",
  email: "kv2518302821@ukr.net",
};

const contract = { id: "ct-1", clientId: "client-1", number: "556811", signedDate: "2022-08-07" };

describe("refreshActSnapshots", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLimitQueue.rows = [];
  });

  it("rebuilds client + contract snapshots from live data (picks up the short name)", async () => {
    mockLimitQueue.rows = [[{ clientId: "client-1" }], [client], [contract]];

    const ok = await refreshActSnapshots("act-1");

    expect(ok).toBe(true);
    expect(mockSetSpy).toHaveBeenCalledTimes(1);
    const payload = mockSetSpy.mock.calls[0]?.[0] as {
      clientSnapshot: { shortName: string | null };
      contractSnapshot: { number: string };
    };
    expect(payload.clientSnapshot.shortName).toBe("ОСББ ШУМНА 22");
    expect(payload.contractSnapshot.number).toBe("556811");
  });

  it("is a no-op when the act is missing", async () => {
    mockLimitQueue.rows = [[]];
    const ok = await refreshActSnapshots("missing");
    expect(ok).toBe(false);
    expect(mockSetSpy).not.toHaveBeenCalled();
  });

  it("is a no-op when the contract is missing", async () => {
    mockLimitQueue.rows = [[{ clientId: "client-1" }], [client], []];
    const ok = await refreshActSnapshots("act-1");
    expect(ok).toBe(false);
    expect(mockSetSpy).not.toHaveBeenCalled();
  });
});

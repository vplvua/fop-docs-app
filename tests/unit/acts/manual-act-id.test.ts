import { describe, expect, it } from "vitest";

import { manualActDate, manualBankTransactionId } from "@/lib/acts/manual-act-id";

describe("manualBankTransactionId", () => {
  it("is prefixed `manual:` so it never collides with a PrivatBank REF+REFN", () => {
    const id = manualBankTransactionId();
    expect(id.startsWith("manual:")).toBe(true);
    // PrivatBank ids are bare reference strings (no colon prefix).
    expect(id).toMatch(/^manual:[0-9a-f-]{36}$/);
  });

  it("generates a unique id each call", () => {
    const ids = new Set(Array.from({ length: 100 }, () => manualBankTransactionId()));
    expect(ids.size).toBe(100);
  });
});

describe("manualActDate", () => {
  it("maps a period month to its last calendar day", () => {
    expect(manualActDate(2025, 12)).toBe("2025-12-31");
    expect(manualActDate(2026, 2)).toBe("2026-02-28");
    expect(manualActDate(2024, 2)).toBe("2024-02-29"); // leap year
    expect(manualActDate(2026, 4)).toBe("2026-04-30");
  });

  it("is independent of any payment date", () => {
    // December period chosen while money arrived in January → act_date is Dec 31.
    expect(manualActDate(2025, 12)).toBe("2025-12-31");
  });
});

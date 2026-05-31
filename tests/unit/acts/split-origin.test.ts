import { describe, expect, it } from "vitest";

import { isSplitPayment, preSplitStatus, splitOriginMarker } from "@/lib/acts/split-origin";

describe("split-origin marker", () => {
  it("marks and recognises a split-managed payment", () => {
    expect(isSplitPayment(splitOriginMarker("skipped"))).toBe(true);
    expect(isSplitPayment(splitOriginMarker("in_queue"))).toBe(true);
  });

  it("does not treat a normal classification (null) or queue reason as a split", () => {
    expect(isSplitPayment(null)).toBe(false);
    expect(isSplitPayment("no_match")).toBe(false);
    expect(isSplitPayment("multiple_clients_same_edrpou:abc")).toBe(false);
  });

  it("restores skipped only when the split came from skipped, else received", () => {
    expect(preSplitStatus(splitOriginMarker("skipped"))).toBe("skipped");
    expect(preSplitStatus(splitOriginMarker("in_queue"))).toBe("received");
    expect(preSplitStatus(splitOriginMarker("received"))).toBe("received");
    expect(preSplitStatus(null)).toBe("received");
  });
});

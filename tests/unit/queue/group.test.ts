import { describe, expect, it } from "vitest";

import { groupByReason, REASON_ORDER } from "@/lib/queue/group";

function row(id: string, classificationReason: string | null) {
  return { id, classificationReason };
}

describe("groupByReason", () => {
  it("buckets payments by reason key, stripping the detail", () => {
    const groups = groupByReason([
      row("a", "client_incomplete:email"),
      row("b", "client_incomplete:address,bank_name"),
      row("c", "no_match"),
    ]);

    const incomplete = groups.find((g) => g.key === "client_incomplete");
    expect(incomplete?.items.map((i) => i.id)).toEqual(["a", "b"]);
    expect(groups.find((g) => g.key === "no_match")?.items.map((i) => i.id)).toEqual(["c"]);
  });

  it("orders groups by the fixed actionability priority", () => {
    const groups = groupByReason([
      row("1", "external_edo"),
      row("2", "no_match"),
      row("3", "client_incomplete:email"),
    ]);

    expect(groups.map((g) => g.key)).toEqual(["no_match", "client_incomplete", "external_edo"]);
  });

  it("sorts legacy ambiguous_client last among known reasons", () => {
    const groups = groupByReason([row("1", "ambiguous_client"), row("2", "no_match")]);
    expect(groups.map((g) => g.key)).toEqual(["no_match", "ambiguous_client"]);
  });

  it("preserves payment insertion order within a group", () => {
    const groups = groupByReason([
      row("x", "no_match"),
      row("y", "no_match"),
      row("z", "no_match"),
    ]);
    expect(groups[0]?.items.map((i) => i.id)).toEqual(["x", "y", "z"]);
  });

  it("places unknown reasons after known ones and the null bucket as `other`", () => {
    const groups = groupByReason([row("1", "made_up"), row("2", null), row("3", "no_match")]);
    const keys = groups.map((g) => g.key);
    expect(keys[0]).toBe("no_match");
    expect(keys).toContain("made_up");
    expect(keys).toContain("other");
    expect(keys.indexOf("no_match")).toBeLessThan(keys.indexOf("made_up"));
  });

  it("covers every classifier reason in the priority order", () => {
    expect(REASON_ORDER).toContain("no_match");
    expect(REASON_ORDER).toContain("sms_quantity_mismatch");
    expect(new Set(REASON_ORDER).size).toBe(REASON_ORDER.length);
  });
});

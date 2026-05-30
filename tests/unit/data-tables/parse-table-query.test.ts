import { describe, it, expect } from "vitest";

import {
  parseTableQuery,
  clampPage,
  totalPagesFor,
  offsetFor,
  DEFAULT_PER_PAGE,
  type TableQueryConfig,
} from "@/lib/data-tables/parse-table-query";

const config: TableQueryConfig = {
  defaultSort: "name",
  defaultDir: "asc",
  sortable: ["name", "amount"],
};

describe("parseTableQuery", () => {
  it("returns defaults for empty params", () => {
    expect(parseTableQuery({}, config)).toEqual({
      page: 1,
      perPage: DEFAULT_PER_PAGE,
      sort: "name",
      dir: "asc",
    });
  });

  it("accepts valid values", () => {
    expect(
      parseTableQuery({ page: "3", perPage: "50", sort: "amount", dir: "desc" }, config),
    ).toEqual({ page: 3, perPage: 50, sort: "amount", dir: "desc" });
  });

  it("rejects a perPage outside {25,50,100}", () => {
    expect(parseTableQuery({ perPage: "30" }, config).perPage).toBe(25);
    expect(parseTableQuery({ perPage: "0" }, config).perPage).toBe(25);
    expect(parseTableQuery({ perPage: "100" }, config).perPage).toBe(100);
  });

  it("rejects a sort key outside the allow-list", () => {
    expect(parseTableQuery({ sort: "evil; drop table" }, config).sort).toBe("name");
    expect(parseTableQuery({ sort: "amount" }, config).sort).toBe("amount");
  });

  it("rejects an invalid direction", () => {
    expect(parseTableQuery({ dir: "sideways" }, config).dir).toBe("asc");
    expect(parseTableQuery({ dir: "desc" }, config).dir).toBe("desc");
  });

  it("floors page at 1 for invalid / non-positive values", () => {
    expect(parseTableQuery({ page: "0" }, config).page).toBe(1);
    expect(parseTableQuery({ page: "-5" }, config).page).toBe(1);
    expect(parseTableQuery({ page: "abc" }, config).page).toBe(1);
    expect(parseTableQuery({ page: "2.9" }, config).page).toBe(2);
  });

  it("uses the first value when a param is repeated", () => {
    expect(parseTableQuery({ sort: ["amount", "name"] }, config).sort).toBe("amount");
  });
});

describe("clampPage / totalPagesFor / offsetFor", () => {
  it("clamps a too-large page to the last page", () => {
    expect(clampPage(99, 25, 100)).toBe(4);
  });

  it("keeps a valid page unchanged", () => {
    expect(clampPage(2, 25, 100)).toBe(2);
  });

  it("returns page 1 for an empty result set", () => {
    expect(clampPage(3, 25, 0)).toBe(1);
    expect(totalPagesFor(0, 25)).toBe(1);
  });

  it("computes total pages with a partial trailing page", () => {
    expect(totalPagesFor(101, 25)).toBe(5);
  });

  it("computes the row offset", () => {
    expect(offsetFor(1, 25)).toBe(0);
    expect(offsetFor(3, 50)).toBe(100);
  });
});

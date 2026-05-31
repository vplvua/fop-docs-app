import { describe, expect, it } from "vitest";

import { actPdfFilename } from "@/lib/acts/pdf-filename";

const base = {
  contractSnapshot: { number: "556609", signedDate: "2024-01-01" },
  actDate: "2024-11-30",
  number: "11/2024",
};

describe("actPdfFilename", () => {
  it("uses act + contract number + year-month for the first act of a month", () => {
    expect(actPdfFilename(base)).toBe("act_556609_2024-11.pdf");
  });

  it("appends the ordinal for the 2nd+ act of a month", () => {
    expect(actPdfFilename({ ...base, number: "11/2024/2" })).toBe("act_556609_2024-11_2.pdf");
  });

  it("takes year-month from the act date, not the act number", () => {
    expect(actPdfFilename({ ...base, actDate: "2024-11-01", number: "11/2024/3" })).toBe(
      "act_556609_2024-11_3.pdf",
    );
  });
});

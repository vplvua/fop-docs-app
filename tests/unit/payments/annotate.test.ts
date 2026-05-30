import { describe, expect, it } from "vitest";

import {
  annotateWithExisting,
  type ExistingPaymentRef,
} from "@/lib/external-apis/privatbank/annotate";
import { mapTransaction } from "@/lib/external-apis/privatbank/mapper";

import { sampleTransaction, sampleTransactionTwo } from "../../mocks/handlers/privatbank";

const one = mapTransaction(sampleTransaction); // bankTransactionId REF001N001
const two = mapTransaction(sampleTransactionTwo); // bankTransactionId REF002N002

describe("annotateWithExisting", () => {
  it("marks all transactions new when none exist", () => {
    const result = annotateWithExisting([one, two], []);
    expect(result.map((r) => r.status)).toEqual(["new", "new"]);
  });

  it("marks a transaction already_imported with payment id, status, and act", () => {
    const existing: ExistingPaymentRef[] = [
      {
        bankTransactionId: one.bankTransactionId,
        id: "pay-1",
        status: "classified",
        actId: "act-9",
      },
    ];
    const [first, second] = annotateWithExisting([one, two], existing);

    expect(first?.status).toBe("already_imported");
    if (first?.status === "already_imported") {
      expect(first.existingPaymentId).toBe("pay-1");
      expect(first.existingStatus).toBe("classified");
      expect(first.actId).toBe("act-9");
    }
    expect(second?.status).toBe("new");
  });

  it("carries a null actId for an imported-but-unclassified payment", () => {
    const existing: ExistingPaymentRef[] = [
      { bankTransactionId: two.bankTransactionId, id: "pay-2", status: "in_queue", actId: null },
    ];
    const result = annotateWithExisting([two], existing);
    expect(result[0]?.status).toBe("already_imported");
    if (result[0]?.status === "already_imported") {
      expect(result[0].actId).toBeNull();
      expect(result[0].existingStatus).toBe("in_queue");
    }
  });

  it("marks every transaction already_imported when all exist", () => {
    const existing: ExistingPaymentRef[] = [
      {
        bankTransactionId: one.bankTransactionId,
        id: "pay-1",
        status: "classified",
        actId: "act-1",
      },
      {
        bankTransactionId: two.bankTransactionId,
        id: "pay-2",
        status: "classified",
        actId: "act-2",
      },
    ];
    const result = annotateWithExisting([one, two], existing);
    expect(result.every((r) => r.status === "already_imported")).toBe(true);
  });
});

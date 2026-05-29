import type { ClientCandidate } from "@/app/(dashboard)/payments/[id]/classification-panel";
import type { MissingField } from "@/lib/queue/missing-fields";

export type { ClientCandidate };

/** Fully server-computed, serializable view model for one queued payment. */
export interface QueueItemVM {
  id: string;
  paymentDate: string;
  amount: string;
  purpose: string;
  payerName: string;
  payerLegalId: string;
  payerBankAccount: string | null;
  /** Raw `key` or `key:detail` reason, retained so the queue can group by it. */
  classificationReason: string | null;
  reasonKey: string;
  reasonDetail: string | null;
  clientId: string | null;
  candidates: ClientCandidate[];
  parsedContractNumbers: string[];
  missingFields: MissingField[];
  unitPrice: string | null;
  serviceType: string | null;
}

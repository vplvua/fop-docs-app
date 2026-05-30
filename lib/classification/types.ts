import type { Client } from "@/lib/db/schema/clients";
import type { Contract } from "@/lib/db/schema/contracts";
import type { Payment } from "@/lib/db/schema/payments";
import type { FopRequisites } from "@/lib/requisites/schema";
import type { PatternEntry } from "@/lib/settings";
import type { SmsPrice, Tariff } from "@/lib/db/schema/tariffs";

export const CLASSIFICATION_REASONS = {
  no_match: "no_match",
  multiple_contracts: "multiple_contracts",
  multiple_clients_same_edrpou: "multiple_clients_same_edrpou",
  ambiguous_client: "ambiguous_client",
  client_incomplete: "client_incomplete",
  auto_act_disabled: "auto_act_disabled",
  external_edo: "external_edo",
  amount_mismatch: "amount_mismatch",
  sms_quantity_mismatch: "sms_quantity_mismatch",
} as const;

export type ClassificationReason =
  (typeof CLASSIFICATION_REASONS)[keyof typeof CLASSIFICATION_REASONS];

export type ServiceType = "access" | "sms";

export interface ClientSnapshot {
  name: string;
  legalId: string;
  address: string;
  bankName: string | null;
  bankAccount: string | null;
  email: string;
}

export interface ContractSnapshot {
  number: string;
  signedDate: string;
}

/** Executor requisites frozen onto the act at generation time (see D3). */
export type FopSnapshot = FopRequisites;

export interface ActStubData {
  clientId: string;
  paymentId: string;
  serviceType: ServiceType;
  unitPrice: string;
  quantity: string;
  quantityUnit: string;
  actDate: string;
  number: string;
  clientSnapshot: ClientSnapshot;
  contractSnapshot: ContractSnapshot;
  fopSnapshot: FopSnapshot | null;
  serviceDescription: string;
  edoProvider: "dubidoc" | "vchasno_external";
}

export type ClassificationResult =
  | {
      status: "classified";
      clientId: string;
      serviceType: ServiceType;
      unitPrice: string;
      quantity: string;
      quantityUnit: string;
      parsedContractNumbers: string[];
      actStub: ActStubData;
    }
  | {
      status: "awaiting_review";
      reason: string;
      clientId: string | null;
      serviceType: ServiceType | null;
      parsedContractNumbers: string[];
    }
  | {
      status: "in_queue";
      reason: string;
      clientId: string | null;
      serviceType: ServiceType | null;
      parsedContractNumbers: string[];
    };

export interface ClassificationInput {
  payment: Payment;
  clients: (Client & { contract: Contract | null })[];
  patterns: PatternEntry[];
  smsKeywords: string[];
  transitEdrpouList: string[];
  tariffs: Tariff[];
  smsPrices: SmsPrice[];
  existingActCount: number;
  /**
   * When set, matching is skipped and this client is used directly (manual
   * link from the UI). The caller is responsible for validating that the
   * client's EDRPOU matches the payer (see `linkPaymentClientAction`).
   */
  forcedClient?: Client & { contract: Contract | null };
}

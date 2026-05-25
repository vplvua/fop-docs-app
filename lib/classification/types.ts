import type { Client } from "@/lib/db/schema/clients";
import type { Contract } from "@/lib/db/schema/contracts";
import type { Payment } from "@/lib/db/schema/payments";
import type { PatternEntry } from "@/lib/settings";
import type { SmsPrice, Tariff } from "@/lib/db/schema/tariffs";

export const CLASSIFICATION_REASONS = {
  no_match: "no_match",
  multiple_contracts: "multiple_contracts",
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
}

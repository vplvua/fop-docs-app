import type { Client } from "@/lib/db/schema/clients";
import type { Contract } from "@/lib/db/schema/contracts";
import type { Payment } from "@/lib/db/schema/payments";
import type { ServiceNames } from "@/lib/services";

import type { ActStubData, ClientSnapshot, ContractSnapshot, ServiceType } from "./types";

export function lastDayOfMonth(dateStr: string): string {
  const [year, month] = dateStr.split("-").map(Number) as [number, number];
  const lastDay = new Date(year, month, 0).getDate();
  const mm = String(month).padStart(2, "0");
  const dd = String(lastDay).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

/**
 * Act number `MM/YYYY` for the first act of a client in a month, `MM/YYYY/N`
 * for the Nth subsequent one. Duplicated in `lib/acts/numbering.ts` — keep both
 * in sync.
 */
export function generateActNumber(
  month: number,
  year: number,
  existingCountInMonth: number,
): string {
  const base = `${String(month).padStart(2, "0")}/${year}`;
  return existingCountInMonth === 0 ? base : `${base}/${existingCountInMonth + 1}`;
}

/** Quantity unit shown on every act — always pieces. */
export const ACT_QUANTITY_UNIT = "шт.";

/**
 * The configured service-line description for the type (no embedded quantity).
 * Names are passed in so this stays a pure function — call sites fetch them via
 * `getServiceNames()` (which falls back to `SERVICE_NAME_DEFAULTS` when unset).
 */
export function buildServiceDescription(serviceType: ServiceType, names: ServiceNames): string {
  return names[serviceType];
}

export function buildClientSnapshot(client: Client): ClientSnapshot {
  return {
    name: client.name,
    legalId: client.legalId,
    address: client.address,
    bankName: client.bankName,
    bankAccount: client.bankAccount,
    email: client.email,
  };
}

export function buildContractSnapshot(contract: Contract): ContractSnapshot {
  return {
    number: contract.number,
    signedDate: contract.signedDate,
  };
}

interface BuildActStubInput {
  client: Client;
  contract: Contract;
  payment: Payment;
  serviceType: ServiceType;
  unitPrice: string;
  quantity: string;
  billingPeriod: "monthly" | "annual";
  existingActCount: number;
  serviceNames: ServiceNames;
}

export function buildActStub(input: BuildActStubInput): ActStubData {
  const { client, contract, payment, serviceType, unitPrice, quantity, serviceNames } = input;

  const actDate = lastDayOfMonth(payment.paymentDate);
  const [year, month] = actDate.split("-").map(Number) as [number, number];
  const number = generateActNumber(month, year, input.existingActCount);

  return {
    clientId: client.id,
    paymentId: payment.id,
    serviceType,
    unitPrice,
    quantity,
    quantityUnit: ACT_QUANTITY_UNIT,
    // The paid total is the act's authoritative sum (D3); for monthly acts it
    // equals unitPrice × quantity, for annual acts it is the discounted amount.
    amount: payment.amount,
    billingPeriod: input.billingPeriod,
    actDate,
    number,
    clientSnapshot: buildClientSnapshot(client),
    contractSnapshot: buildContractSnapshot(contract),
    // Filled from current requisites in run-classification (needs DB access).
    fopSnapshot: null,
    serviceDescription: buildServiceDescription(serviceType, serviceNames),
    edoProvider: client.edoProvider,
  };
}

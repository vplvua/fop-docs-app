import type { Client } from "@/lib/db/schema/clients";
import type { Contract } from "@/lib/db/schema/contracts";
import type { Payment } from "@/lib/db/schema/payments";

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

/** Fixed service descriptions (no embedded quantity). */
export function buildServiceDescription(serviceType: ServiceType): string {
  if (serviceType === "access") {
    return 'Надання доступу до сервісу "Моє ОСББ" (один календарний місяць)';
  }
  return "Інтернет послуги (розсилка повідомлень)";
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
  existingActCount: number;
}

export function buildActStub(input: BuildActStubInput): ActStubData {
  const { client, contract, payment, serviceType, unitPrice, quantity } = input;

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
    actDate,
    number,
    clientSnapshot: buildClientSnapshot(client),
    contractSnapshot: buildContractSnapshot(contract),
    // Filled from current requisites in run-classification (needs DB access).
    fopSnapshot: null,
    serviceDescription: buildServiceDescription(serviceType),
    edoProvider: client.edoProvider,
  };
}

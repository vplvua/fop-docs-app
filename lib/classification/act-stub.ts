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

export function generateActNumber(month: number, existingCountInMonth: number): string {
  if (existingCountInMonth === 0) {
    return `№${month}`;
  }
  return `№${month}/${existingCountInMonth + 1}`;
}

export function buildServiceDescription(
  serviceType: ServiceType,
  quantity: string,
  quantityUnit: string,
): string {
  if (serviceType === "access") {
    return `Доступ до сервісу за період ${quantity} ${quantityUnit}`;
  }
  return `СМС-розсилка ${quantity} ${quantityUnit}`;
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
  quantityUnit: string;
  existingActCount: number;
}

export function buildActStub(input: BuildActStubInput): ActStubData {
  const { client, contract, payment, serviceType, unitPrice, quantity, quantityUnit } = input;

  const actDate = lastDayOfMonth(payment.paymentDate);
  const month = new Date(payment.paymentDate).getMonth() + 1;
  const number = generateActNumber(month, input.existingActCount);

  return {
    clientId: client.id,
    paymentId: payment.id,
    serviceType,
    unitPrice,
    quantity,
    quantityUnit,
    actDate,
    number,
    clientSnapshot: buildClientSnapshot(client),
    contractSnapshot: buildContractSnapshot(contract),
    serviceDescription: buildServiceDescription(serviceType, quantity, quantityUnit),
    edoProvider: client.edoProvider,
  };
}

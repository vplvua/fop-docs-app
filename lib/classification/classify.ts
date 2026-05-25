import { resolveAccessPrice, resolveSmsPrice } from "@/lib/tariffs/resolve";

import { buildActStub } from "./act-stub";
import { checkCompleteness } from "./check-completeness";
import { detectServiceType } from "./detect-service-type";
import { matchClient } from "./match-client";
import { parseContractNumbers } from "./parse-contract-numbers";
import { resolveQuantity } from "./resolve-quantity";
import { CLASSIFICATION_REASONS } from "./types";
import type { ClassificationInput, ClassificationResult } from "./types";

export function classify(input: ClassificationInput): ClassificationResult {
  const { payment, clients, patterns, smsKeywords, transitEdrpouList, tariffs, smsPrices } = input;

  // Step 1: parse contract numbers from purpose
  const parsedContractNumbers = parseContractNumbers(payment.purpose, patterns);

  // Step 2: multiple contracts check
  if (parsedContractNumbers.length > 1) {
    return {
      status: "in_queue",
      reason: `${CLASSIFICATION_REASONS.multiple_contracts}:${parsedContractNumbers.join(",")}`,
      clientId: null,
      serviceType: null,
      parsedContractNumbers,
    };
  }

  // Step 3: match client
  const matchResult = matchClient(
    parsedContractNumbers,
    payment.payerLegalId,
    clients,
    transitEdrpouList,
  );

  if (matchResult.status === "in_queue") {
    return {
      status: "in_queue",
      reason: matchResult.reason,
      clientId: null,
      serviceType: null,
      parsedContractNumbers,
    };
  }

  const client = matchResult.client;

  // Step 4: auto_act_disabled check
  if (client.autoActDisabled) {
    return {
      status: "awaiting_review",
      reason: CLASSIFICATION_REASONS.auto_act_disabled,
      clientId: client.id,
      serviceType: null,
      parsedContractNumbers,
    };
  }

  // Step 5: edo_provider check
  if (client.edoProvider === "vchasno_external") {
    return {
      status: "awaiting_review",
      reason: CLASSIFICATION_REASONS.external_edo,
      clientId: client.id,
      serviceType: null,
      parsedContractNumbers,
    };
  }

  // Step 6: detect service type
  const serviceType = detectServiceType(payment.purpose, smsKeywords);

  // Step 7: completeness check
  const missing = checkCompleteness(client, client.contract, serviceType);
  if (missing.length > 0) {
    return {
      status: "in_queue",
      reason: `${CLASSIFICATION_REASONS.client_incomplete}:${missing.join(",")}`,
      clientId: client.id,
      serviceType,
      parsedContractNumbers,
    };
  }

  // Step 8: resolve price + quantity
  const unitPrice =
    serviceType === "access"
      ? resolveAccessPrice(
          {
            apartmentsCount: client.apartmentsCount,
            accessPriceOverride: client.accessPriceOverride,
          },
          tariffs,
          payment.paymentDate,
        )
      : resolveSmsPrice(smsPrices, payment.paymentDate);

  if (!unitPrice) {
    return {
      status: "in_queue",
      reason: CLASSIFICATION_REASONS.amount_mismatch,
      clientId: client.id,
      serviceType,
      parsedContractNumbers,
    };
  }

  const qtyResult = resolveQuantity(serviceType, payment.amount, unitPrice, payment.purpose);

  if (qtyResult.status === "mismatch") {
    return {
      status: "in_queue",
      reason: qtyResult.reason,
      clientId: client.id,
      serviceType,
      parsedContractNumbers,
    };
  }

  const actStub = buildActStub({
    client,
    contract: client.contract!,
    payment,
    serviceType,
    unitPrice,
    quantity: qtyResult.quantity,
    quantityUnit: qtyResult.quantityUnit,
    existingActCount: input.existingActCount,
  });

  return {
    status: "classified",
    clientId: client.id,
    serviceType,
    unitPrice,
    quantity: qtyResult.quantity,
    quantityUnit: qtyResult.quantityUnit,
    parsedContractNumbers,
    actStub,
  };
}

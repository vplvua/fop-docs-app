/**
 * Guardrail for manual payment→client linking: a payment may only be linked to
 * a client that belongs to the payer. For normal payments that means the
 * client's EDRPOU must equal the payer's EDRPOU; for transit payments (where
 * the payer EDRPOU is the intermediary bank's) the client must be identified by
 * one of the contract numbers parsed from the payment purpose.
 */
export function isClientLinkableToPayment(params: {
  isTransit: boolean;
  payerLegalId: string;
  clientLegalId: string;
  clientContractNumber: string | null;
  parsedContractNumbers: string[];
}): boolean {
  if (params.isTransit) {
    return (
      params.clientContractNumber !== null &&
      params.parsedContractNumbers.includes(params.clientContractNumber)
    );
  }
  return params.clientLegalId === params.payerLegalId;
}

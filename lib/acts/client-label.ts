/** A contract-bearing client row as listed in the act client pickers. */
export interface ContractClient {
  id: string;
  name: string;
  shortName: string | null;
  legalId: string;
  contractNumber: string;
}

/** Display label for the picker: curated short name → contract number → EDRPOU.
 * The full legal name is deliberately never shown (too long for a dropdown row);
 * it still participates in search. */
export function clientLabel(c: ContractClient): string {
  const name = c.shortName || (c.contractNumber ? `Договір №${c.contractNumber}` : "");
  if (!name) return c.legalId || "—";
  return c.legalId ? `${name} (${c.legalId})` : name;
}

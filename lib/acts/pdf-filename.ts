import type { Act } from "@/lib/db/schema/acts";

interface ActContractSnapshot {
  number: string;
}

/**
 * Download/EDO filename for an act PDF: `act_<contract>_<YYYY-MM>[_N].pdf`.
 *
 * - contract number comes from the frozen contract snapshot;
 * - `YYYY-MM` is taken from the act date;
 * - the `_N` ordinal is appended only when the act is the 2nd+ in its month,
 *   i.e. its `number` carries a third `MM/YYYY/N` segment (e.g. `11/2024/2`).
 *
 * Examples: `act_556609_2024-11.pdf`, `act_556609_2024-11_2.pdf`.
 */
export function actPdfFilename(act: Pick<Act, "contractSnapshot" | "actDate" | "number">): string {
  const contractNumber = (act.contractSnapshot as ActContractSnapshot).number;
  const yearMonth = act.actDate.slice(0, 7);
  const ordinal = act.number.split("/")[2];
  const suffix = ordinal ? `_${ordinal}` : "";
  return `act_${contractNumber}_${yearMonth}${suffix}.pdf`;
}

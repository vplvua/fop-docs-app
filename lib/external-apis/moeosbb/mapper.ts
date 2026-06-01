import type { MoeosbbRemoteClient } from "./types";

export interface ClientSyncFields {
  name: string;
  legalId: string;
  address: string;
  bankName: string;
  bankAccount: string;
  email: string;
}

export function mapRemoteToClientFields(remote: MoeosbbRemoteClient): ClientSyncFields {
  return {
    name: remote.full_name,
    legalId: remote.osbb_zkpo,
    address: remote.legal_address,
    bankName: remote.osbb_bank,
    bankAccount: remote.osbb_rr,
    email: remote.contract_email,
  };
}

/**
 * Normalize `osbb_users.createdt` into a `YYYY-MM-DD` string suitable for the
 * `contracts.signed_date` (Postgres `date`) column. Accepts MySQL `DATE` /
 * `DATETIME` (`YYYY-MM-DD[ HH:MM:SS]`) and `DD.MM.YYYY` / `DD/MM/YYYY` forms.
 * Returns `null` for empty, zero-dates (`0000-00-00`), or unparseable input so
 * the sync can skip the update instead of writing garbage.
 */
export function mapRemoteContractDate(remote: MoeosbbRemoteClient): string | null {
  const raw = (remote.createdt ?? "").trim();
  if (!raw) return null;

  const iso = /^(\d{4})-(\d{2})-(\d{2})/u.exec(raw);
  if (iso) {
    const [, y, m, d] = iso;
    if (y === "0000" || m === "00" || d === "00") return null;
    return `${y}-${m}-${d}`;
  }

  const dmy = /^(\d{2})[./](\d{2})[./](\d{4})/u.exec(raw);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${m}-${d}`;
  }

  return null;
}

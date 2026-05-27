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

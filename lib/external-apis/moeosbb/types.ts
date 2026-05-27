export interface MoeosbbRemoteClient {
  id: string;
  full_name: string;
  osbb_zkpo: string;
  legal_address: string;
  osbb_bank: string;
  osbb_rr: string;
  contract_email: string;
}

export interface MoeosbbSyncResponse {
  ok: boolean;
  updated_at: string;
  count: number;
  clients: MoeosbbRemoteClient[];
}

export class MoeosbbAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MoeosbbAuthError";
  }
}

export class MoeosbbApiError extends Error {
  readonly statusCode: number;
  constructor(statusCode: number, message: string) {
    super(message);
    this.name = "MoeosbbApiError";
    this.statusCode = statusCode;
  }
}

export interface DubiDocParticipant {
  action: "sign";
  email: string;
  edrpou: string;
  priority: number;
  isSignatureRequired: boolean;
}

export interface CreateDocumentRequest {
  file: string;
  filename: string;
  title: string;
  date: string;
  number: string;
  amount: number;
  signatureType: "external";
  workflowType: "sequential";
  participants: DubiDocParticipant[];
}

export interface CreateDocumentResponse {
  id: string;
  status: string;
}

export interface DocumentStatusResponse {
  id: string;
  status: string;
  archived?: boolean;
  refused?: boolean;
}

export class DubiDocAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DubiDocAuthError";
  }
}

export class DubiDocApiError extends Error {
  readonly statusCode: number;
  constructor(statusCode: number, message: string) {
    super(message);
    this.name = "DubiDocApiError";
    this.statusCode = statusCode;
  }
}

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
  /** Total in kopiykas (integer minor units) — DubiDoc divides by 100 for display. */
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
  /**
   * Org-relative status — "Визначається для поточного авторизованого
   * користувача/організації". After the FOP (owner) signs, this reads `signed`
   * from the FOP's perspective even though the client has not signed. Use
   * `state` for the document-level signal; `status` only disambiguates whether
   * the FOP has signed while `state` is still `new`.
   */
  status: string;
  /** Document-level lifecycle: `new` → `sent` (to client) → `signed` (all parties). */
  state?: "new" | "sent" | "signed";
  archived?: boolean;
  refused?: boolean;
}

/** Response of `POST /documents/{id}/links` — a public, action-scoped URL. */
export interface GenerateLinkResponse {
  link: string;
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

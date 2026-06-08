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
   * from the FOP's perspective even though the client has not signed. Reads
   * `"cancelled"` once the document has been анульовано (voided via a signed
   * cancellation act) — the authoritative signal that the live copy is gone.
   */
  status: string;
  /**
   * Document-level lifecycle: `new` → `sent` (to client) → `signed`. NOT
   * reliable for "fully signed": DubiDoc leaves it at `sent` even after every
   * party has signed (verified 2026-06-05). Used only as a `signed` fast-path.
   */
  state?: "new" | "sent" | "signed";
  /**
   * `true` when the document is filed into an archive folder. NOT a removal —
   * an archived document is a normal (typically signed) document, so it derives
   * its status via the signature branches like any other.
   */
  archived?: boolean;
  refused?: boolean;
  /**
   * Present when the document was cancelled (анульовано). Informational only —
   * `status === "cancelled"` is the signal the mapper keys on.
   */
  cancellationAct?: unknown;
  /**
   * Relationship of the authenticated org (our owner account) to the document.
   * `currentUser.status === "signed"` means the FOP (owner) has signed.
   */
  currentUser?: {
    role?: string;
    status?: ParticipantStatus;
  };
}

export type ParticipantStatus =
  | "created"
  | "pending"
  | "signed"
  | "viewed"
  | "filled"
  | "approved"
  | "rejected"
  | "cancelled";

/** One node of a document's route, from `GET /documents/{id}/participants`. */
export interface DocumentParticipant {
  status: ParticipantStatus;
  role:
    | "ROLE_OWNER"
    | "DOCUMENT_FILLER"
    | "DOCUMENT_SIGNER"
    | "DOCUMENT_APPROVER"
    | "DOCUMENT_VIEWER";
  isSignatureRequired: boolean;
  priority: number;
  edrpou?: string | null;
  result?: { executionDate?: string; comment?: string | null } | null;
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

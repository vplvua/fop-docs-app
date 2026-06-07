import { http, HttpResponse } from "msw";

import type {
  CreateDocumentResponse,
  DocumentParticipant,
  DocumentStatusResponse,
  GenerateLinkResponse,
} from "@/lib/external-apis/dubidoc";

const DEFAULT_STATUS: DocumentStatusResponse = {
  id: "mock-doc-001",
  status: "new",
  state: "new",
  archived: false,
  refused: false,
  currentUser: { role: "ROLE_OWNER", status: "pending" },
};

let mockDocStatus: DocumentStatusResponse = { ...DEFAULT_STATUS };
let mockParticipants: DocumentParticipant[] = [];

export function setMockDocStatus(status: Partial<DocumentStatusResponse>): void {
  mockDocStatus = { ...mockDocStatus, ...status };
}

export function setMockParticipants(participants: DocumentParticipant[]): void {
  mockParticipants = participants;
}

export function resetMockDocStatus(): void {
  mockDocStatus = { ...DEFAULT_STATUS };
  mockParticipants = [];
}

export const dubidocHandlers = [
  http.post("https://api.dubidoc.com.ua/api/v1/documents", () => {
    const response: CreateDocumentResponse = { id: "mock-doc-001", status: "new" };
    return HttpResponse.json(response);
  }),

  http.get("https://api.dubidoc.com.ua/api/v1/documents/:id/participants", () =>
    HttpResponse.json(mockParticipants),
  ),

  http.get("https://api.dubidoc.com.ua/api/v1/documents/:id", () =>
    HttpResponse.json(mockDocStatus),
  ),

  http.post("https://api.dubidoc.com.ua/api/v1/documents/:id/sign", () =>
    HttpResponse.json({ success: true }),
  ),

  http.post("https://api.dubidoc.com.ua/api/v1/documents/:id/links", ({ params }) => {
    const response: GenerateLinkResponse = {
      link: `https://my.dubidoc.com.ua/sign/${String(params.id)}`,
    };
    return HttpResponse.json(response);
  }),

  http.delete("https://api.dubidoc.com.ua/api/v1/documents/:id/links", () =>
    HttpResponse.json({ success: true }),
  ),

  http.post("https://api.dubidoc.com.ua/api/v1/documents/:id/send", () =>
    HttpResponse.json({ success: true }),
  ),
];

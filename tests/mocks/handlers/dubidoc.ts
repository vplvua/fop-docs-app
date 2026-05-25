import { http, HttpResponse } from "msw";

import type { CreateDocumentResponse, DocumentStatusResponse } from "@/lib/external-apis/dubidoc";

let mockDocStatus: DocumentStatusResponse = {
  id: "mock-doc-001",
  status: "new",
  archived: false,
  refused: false,
};

export function setMockDocStatus(status: Partial<DocumentStatusResponse>): void {
  mockDocStatus = { ...mockDocStatus, ...status };
}

export function resetMockDocStatus(): void {
  mockDocStatus = { id: "mock-doc-001", status: "new", archived: false, refused: false };
}

export const dubidocHandlers = [
  http.post("https://api.dubidoc.com.ua/api/v1/documents", () => {
    const response: CreateDocumentResponse = { id: "mock-doc-001", status: "new" };
    return HttpResponse.json(response);
  }),

  http.get("https://api.dubidoc.com.ua/api/v1/documents/:id", () =>
    HttpResponse.json(mockDocStatus),
  ),
];

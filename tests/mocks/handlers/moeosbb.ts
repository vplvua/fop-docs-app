import { http, HttpResponse } from "msw";

import type { MoeosbbRemoteClient, MoeosbbSyncResponse } from "@/lib/external-apis/moeosbb/types";

const SYNC_URL = "https://moeosbb-sync.test/api.php";

const sampleClients: MoeosbbRemoteClient[] = [
  {
    id: "42",
    full_name: "ОСББ «Тестове»",
    osbb_zkpo: "12345678",
    legal_address: "вул. Тестова, 1",
    osbb_bank: "ПАТ «ТестБанк»",
    osbb_rr: "UA123456789012345678901234567",
    contract_email: "test@example.com",
  },
  {
    id: "99",
    full_name: "ОСББ «Друге»",
    osbb_zkpo: "87654321",
    legal_address: "вул. Друга, 2",
    osbb_bank: "ПАТ «Інший Банк»",
    osbb_rr: "UA765432109876543210987654321",
    contract_email: "other@example.com",
  },
];

const successResponse: MoeosbbSyncResponse = {
  ok: true,
  updated_at: "2026-05-27T03:00:00+03:00",
  count: sampleClients.length,
  clients: sampleClients,
};

export const moeosbbHandlers = [http.get(SYNC_URL, () => HttpResponse.json(successResponse))];

export { sampleClients, SYNC_URL };

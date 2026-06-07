import { describe, expect, it, vi } from "vitest";

import { mapDubidocStatus } from "@/lib/edo/dubidoc-status";
import type { DocumentParticipant, DocumentStatusResponse } from "@/lib/external-apis/dubidoc";

function detail(over: Partial<DocumentStatusResponse>): DocumentStatusResponse {
  return { id: "d", status: "new", ...over };
}

function participant(over: Partial<DocumentParticipant>): DocumentParticipant {
  return {
    status: "signed",
    role: "DOCUMENT_SIGNER",
    isSignatureRequired: true,
    priority: 1,
    ...over,
  };
}

/** A participants-fetcher whose call count can be asserted. */
function fetcher(participants: DocumentParticipant[] = []) {
  return vi.fn(() => Promise.resolve(participants));
}

describe("mapDubidocStatus", () => {
  it("FOP signed + client signed but state stuck at 'sent' → signed", async () => {
    // The exact production bug: state never rolls up, but per-node statuses are signed.
    const fetch = fetcher([participant({ status: "signed" })]);
    const patch = await mapDubidocStatus(
      detail({
        state: "sent",
        status: "signed",
        currentUser: { role: "ROLE_OWNER", status: "signed" },
      }),
      fetch,
    );
    expect(patch).toEqual({ status: "signed", edoStatus: "signed" });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("fast-path state=signed → signed without fetching participants", async () => {
    const fetch = fetcher();
    expect(await mapDubidocStatus(detail({ state: "signed", status: "signed" }), fetch)).toEqual({
      status: "signed",
      edoStatus: "signed",
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("FOP signed, client signature still pending → waiting_for_client_sign", async () => {
    const fetch = fetcher([participant({ status: "pending" })]);
    expect(
      await mapDubidocStatus(
        detail({ state: "sent", status: "signed", currentUser: { status: "signed" } }),
        fetch,
      ),
    ).toEqual({ status: "waiting_for_client_sign", edoStatus: "signed" });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("FOP has not signed yet → sent_to_edo without fetching participants", async () => {
    const fetch = fetcher();
    expect(
      await mapDubidocStatus(
        detail({ state: "new", status: "new", currentUser: { status: "pending" } }),
        fetch,
      ),
    ).toEqual({ status: "sent_to_edo", edoStatus: "new" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("non-required participants do not gate signed", async () => {
    const fetch = fetcher([
      participant({ status: "signed", isSignatureRequired: true }),
      participant({ status: "viewed", isSignatureRequired: false, role: "DOCUMENT_VIEWER" }),
    ]);
    expect(
      await mapDubidocStatus(detail({ state: "sent", currentUser: { status: "signed" } }), fetch),
    ).toEqual({ status: "signed", edoStatus: "signed" });
  });

  it("archived flag → deleted (override), no fetch", async () => {
    const fetch = fetcher();
    expect(
      await mapDubidocStatus(detail({ state: "signed", status: "signed", archived: true }), fetch),
    ).toEqual({ status: "deleted", edoStatus: "archived" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("refused flag → edo_status refused, lifecycle unchanged", async () => {
    expect(
      await mapDubidocStatus(detail({ status: "whatever", refused: true }), fetcher()),
    ).toEqual({
      edoStatus: "refused",
    });
  });

  it("a participant rejection → refused", async () => {
    const fetch = fetcher([participant({ status: "rejected" })]);
    expect(
      await mapDubidocStatus(detail({ state: "sent", currentUser: { status: "signed" } }), fetch),
    ).toEqual({ edoStatus: "refused" });
  });

  describe("fallback when currentUser is absent (legacy/mocks)", () => {
    it("state=sent → waiting_for_client_sign", async () => {
      expect(await mapDubidocStatus(detail({ state: "sent", status: "x" }), fetcher())).toEqual({
        status: "waiting_for_client_sign",
        edoStatus: "sent",
      });
    });

    it("state=new + org status=signed → waiting_for_client_sign", async () => {
      expect(await mapDubidocStatus(detail({ state: "new", status: "signed" }), fetcher())).toEqual(
        {
          status: "waiting_for_client_sign",
          edoStatus: "signed",
        },
      );
    });

    it("no state, org status=signed → signed", async () => {
      expect(await mapDubidocStatus(detail({ status: "signed" }), fetcher())).toEqual({
        status: "signed",
        edoStatus: "signed",
      });
    });

    it("unknown intermediate status recorded raw without moving the lifecycle", async () => {
      expect(await mapDubidocStatus(detail({ status: "sent_for_sign" }), fetcher())).toEqual({
        edoStatus: "sent_for_sign",
      });
    });
  });
});

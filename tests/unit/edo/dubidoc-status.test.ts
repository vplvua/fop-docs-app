import { describe, expect, it } from "vitest";

import { mapDubidocStatus } from "@/lib/edo/dubidoc-status";

describe("mapDubidocStatus", () => {
  it("maps signed → status signed", () => {
    expect(mapDubidocStatus({ id: "d", status: "signed" })).toEqual({
      status: "signed",
      edoStatus: "signed",
    });
  });

  it("maps archived flag → status deleted", () => {
    expect(mapDubidocStatus({ id: "d", status: "whatever", archived: true })).toEqual({
      status: "deleted",
      edoStatus: "archived",
    });
  });

  it("maps refused flag → edo_status refused, lifecycle unchanged", () => {
    expect(mapDubidocStatus({ id: "d", status: "whatever", refused: true })).toEqual({
      edoStatus: "refused",
    });
  });

  it("maps new → sent_to_edo (awaiting the FOP's signature)", () => {
    expect(mapDubidocStatus({ id: "d", status: "new" })).toEqual({
      status: "sent_to_edo",
      edoStatus: "new",
    });
  });

  it("maps waiting_for_contractor_sign → waiting_for_client_sign (FOP signed, client pending)", () => {
    expect(mapDubidocStatus({ id: "d", status: "waiting_for_contractor_sign" })).toEqual({
      status: "waiting_for_client_sign",
      edoStatus: "waiting_for_contractor_sign",
    });
  });

  it("records an unknown intermediate status raw without moving the lifecycle", () => {
    expect(mapDubidocStatus({ id: "d", status: "sent_for_sign" })).toEqual({
      edoStatus: "sent_for_sign",
    });
  });

  it("prefers signed over the archived flag", () => {
    expect(mapDubidocStatus({ id: "d", status: "signed", archived: true })).toEqual({
      status: "signed",
      edoStatus: "signed",
    });
  });

  it("prefers the archived flag over a new/intermediate status", () => {
    expect(mapDubidocStatus({ id: "d", status: "new", archived: true })).toEqual({
      status: "deleted",
      edoStatus: "archived",
    });
  });

  describe("document-level state (authoritative)", () => {
    it("state=signed → signed (all parties)", () => {
      expect(mapDubidocStatus({ id: "d", status: "signed", state: "signed" })).toEqual({
        status: "signed",
        edoStatus: "signed",
      });
    });

    it("state=sent → waiting_for_client_sign (forwarded to client)", () => {
      expect(
        mapDubidocStatus({ id: "d", status: "waiting_for_contractor_sign", state: "sent" }),
      ).toEqual({
        status: "waiting_for_client_sign",
        edoStatus: "sent",
      });
    });

    it("state=new + org status=signed → waiting_for_client_sign (FOP signed, not yet advanced)", () => {
      // The exact regression: org-relative `signed` must NOT mark the act fully signed.
      expect(mapDubidocStatus({ id: "d", status: "signed", state: "new" })).toEqual({
        status: "waiting_for_client_sign",
        edoStatus: "signed",
      });
    });

    it("state=new + org status=new → sent_to_edo (awaiting the FOP)", () => {
      expect(mapDubidocStatus({ id: "d", status: "new", state: "new" })).toEqual({
        status: "sent_to_edo",
        edoStatus: "new",
      });
    });

    it("state=signed wins over the archived flag", () => {
      expect(
        mapDubidocStatus({ id: "d", status: "signed", state: "signed", archived: true }),
      ).toEqual({
        status: "signed",
        edoStatus: "signed",
      });
    });

    it("archived wins over an unfinished state=new", () => {
      expect(mapDubidocStatus({ id: "d", status: "signed", state: "new", archived: true })).toEqual(
        {
          status: "deleted",
          edoStatus: "archived",
        },
      );
    });
  });
});

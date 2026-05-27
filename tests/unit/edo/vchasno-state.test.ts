import { describe, expect, it } from "vitest";

import { validateVchasnoTransition } from "@/lib/edo/vchasno-state";

describe("validateVchasnoTransition", () => {
  describe("valid transitions for vchasno_external", () => {
    it("allows draft → signed", () => {
      const result = validateVchasnoTransition("draft", "signed", "vchasno_external");
      expect(result).toEqual({ ok: true });
    });

    it("allows signed → draft", () => {
      const result = validateVchasnoTransition("signed", "draft", "vchasno_external");
      expect(result).toEqual({ ok: true });
    });
  });

  describe("rejected transitions for wrong provider", () => {
    it("rejects draft → signed for dubidoc", () => {
      const result = validateVchasnoTransition("draft", "signed", "dubidoc");
      expect(result).toEqual({
        ok: false,
        error: "Операція доступна лише для Вчасно-актів",
      });
    });

    it("rejects signed → draft for dubidoc", () => {
      const result = validateVchasnoTransition("signed", "draft", "dubidoc");
      expect(result).toEqual({
        ok: false,
        error: "Операція доступна лише для Вчасно-актів",
      });
    });
  });

  describe("action-level guards", () => {
    it("markActSigned: rejects dubidoc provider", () => {
      const result = validateVchasnoTransition("draft", "signed", "dubidoc");
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain("Вчасно");
    });

    it("unmarkActSigned: rejects non-signed vchasno act", () => {
      const result = validateVchasnoTransition("draft", "draft", "vchasno_external");
      expect(result.ok).toBe(false);
    });

    it("markActSigned: rejects already-signed vchasno act", () => {
      const result = validateVchasnoTransition("signed", "signed", "vchasno_external");
      expect(result.ok).toBe(false);
    });

    it("unmarkActSigned: rejects dubidoc signed act", () => {
      const result = validateVchasnoTransition("signed", "draft", "dubidoc");
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain("Вчасно");
    });
  });

  describe("rejected transitions for invalid status", () => {
    it("rejects draft → draft", () => {
      const result = validateVchasnoTransition("draft", "draft", "vchasno_external");
      expect(result.ok).toBe(false);
    });

    it("rejects signed → signed", () => {
      const result = validateVchasnoTransition("signed", "signed", "vchasno_external");
      expect(result.ok).toBe(false);
    });

    it("rejects draft → sent_to_edo", () => {
      const result = validateVchasnoTransition("draft", "sent_to_edo", "vchasno_external");
      expect(result.ok).toBe(false);
    });

    it("rejects draft → deleted", () => {
      const result = validateVchasnoTransition("draft", "deleted", "vchasno_external");
      expect(result.ok).toBe(false);
    });

    it("rejects sent_to_edo → signed", () => {
      const result = validateVchasnoTransition("sent_to_edo", "signed", "vchasno_external");
      expect(result.ok).toBe(false);
    });

    it("rejects deleted → draft", () => {
      const result = validateVchasnoTransition("deleted", "draft", "vchasno_external");
      expect(result.ok).toBe(false);
    });

    it("rejects signed → deleted", () => {
      const result = validateVchasnoTransition("signed", "deleted", "vchasno_external");
      expect(result.ok).toBe(false);
    });
  });
});

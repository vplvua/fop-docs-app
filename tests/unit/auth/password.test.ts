import { describe, expect, it } from "vitest";

import { verifyPassword } from "@/lib/auth/password";

// argon2id hash of literal "correct-password" with m=19456,t=2,p=1.
const KNOWN_HASH =
  "$argon2id$v=19$m=19456,t=2,p=1$YfuKIkDZtEgdEwasdqbWCg$Uan4JLzOEruv5Ct6a1ohMyzxv10N59I5nMPAJks0TvM";

describe("verifyPassword", () => {
  it("returns true for the correct password against a known hash", async () => {
    await expect(verifyPassword("correct-password", KNOWN_HASH)).resolves.toBe(true);
  });

  it("returns false for the wrong password", async () => {
    await expect(verifyPassword("nope", KNOWN_HASH)).resolves.toBe(false);
  });

  it("returns false (no throw) for a malformed hash", async () => {
    await expect(verifyPassword("anything", "not-a-real-hash")).resolves.toBe(false);
  });

  it("returns false for empty password", async () => {
    await expect(verifyPassword("", KNOWN_HASH)).resolves.toBe(false);
  });

  it("returns false for empty hash", async () => {
    await expect(verifyPassword("anything", "")).resolves.toBe(false);
  });
});

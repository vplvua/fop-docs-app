import { describe, expect, it } from "vitest";

import {
  SESSION_COOKIE_NAME,
  SESSION_TTL_SECONDS,
  clearedSessionCookie,
  sessionCookie,
} from "@/lib/auth/cookie";

describe("cookie constants", () => {
  it("uses the __Host- prefix", () => {
    expect(SESSION_COOKIE_NAME).toBe("__Host-session");
  });

  it("uses a 30-day TTL in seconds", () => {
    expect(SESSION_TTL_SECONDS).toBe(60 * 60 * 24 * 30);
  });
});

describe("sessionCookie", () => {
  it("returns all attributes required by the spec (httpOnly, Secure, Lax, path=/)", () => {
    const expires = new Date("2030-01-01T00:00:00Z");
    const c = sessionCookie("token-value", expires);
    expect(c).toEqual({
      name: SESSION_COOKIE_NAME,
      value: "token-value",
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      expires,
      maxAge: SESSION_TTL_SECONDS,
    });
  });
});

describe("clearedSessionCookie", () => {
  it("uses epoch-zero expiry and Max-Age=0", () => {
    const c = clearedSessionCookie();
    expect(c.value).toBe("");
    expect(c.expires.getTime()).toBe(0);
    expect(c.maxAge).toBe(0);
    expect(c.path).toBe("/");
    expect(c.httpOnly).toBe(true);
    expect(c.secure).toBe(true);
  });
});

import { describe, expect, it } from "vitest";

import { parseSafeNext } from "@/lib/auth/safe-next";

describe("parseSafeNext", () => {
  it("accepts absolute paths", () => {
    expect(parseSafeNext("/clients")).toBe("/clients");
    expect(parseSafeNext("/clients?tab=archive")).toBe("/clients?tab=archive");
    expect(parseSafeNext("/payments/123")).toBe("/payments/123");
    expect(parseSafeNext("/")).toBe("/");
  });

  it("rejects external URLs", () => {
    expect(parseSafeNext("https://evil.example/")).toBe("/");
    expect(parseSafeNext("http://attacker.test/")).toBe("/");
  });

  it("rejects scheme-relative URLs", () => {
    expect(parseSafeNext("//evil.example/")).toBe("/");
  });

  it("rejects backslash tricks (some browsers normalize /\\ to //)", () => {
    expect(parseSafeNext("/\\evil.example")).toBe("/");
  });

  it("rejects javascript: and data: schemes", () => {
    expect(parseSafeNext("javascript:alert(1)")).toBe("/");
    expect(parseSafeNext("data:text/html,xss")).toBe("/");
  });

  it("treats empty / null / undefined as root", () => {
    expect(parseSafeNext("")).toBe("/");
    expect(parseSafeNext(null)).toBe("/");
    expect(parseSafeNext(undefined)).toBe("/");
  });

  it("rejects paths without leading slash", () => {
    expect(parseSafeNext("clients")).toBe("/");
    expect(parseSafeNext("relative/path")).toBe("/");
  });
});

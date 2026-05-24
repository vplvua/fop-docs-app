/**
 * Browser-enforced `__Host-` prefix requires `Secure`, `Path=/`, and no
 * `Domain` attribute — blocks subdomain hijack and accidental http issuance.
 * Chrome/Firefox/Safari honor Secure cookies on `localhost` so dev works.
 */
export const SESSION_COOKIE_NAME = "__Host-session";

export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

export type SameSite = "lax" | "strict" | "none";

export interface SessionCookieOptions {
  name: typeof SESSION_COOKIE_NAME;
  value: string;
  httpOnly: true;
  secure: true;
  sameSite: SameSite;
  path: "/";
  expires: Date;
  maxAge: number;
}

export function sessionCookie(value: string, expires: Date): SessionCookieOptions {
  return {
    name: SESSION_COOKIE_NAME,
    value,
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    expires,
    maxAge: SESSION_TTL_SECONDS,
  };
}

export function clearedSessionCookie(): SessionCookieOptions {
  return {
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    expires: new Date(0),
    maxAge: 0,
  };
}

import { type NextRequest, NextResponse } from "next/server";

import { SESSION_COOKIE_NAME, clearedSessionCookie, validateSession } from "@/lib/auth";

/**
 * Next.js 16 Proxy (renamed from Middleware). Runs on Node (Fluid Compute),
 * so `lib/auth` — which talks to Neon over HTTP — works here directly.
 *
 * Q-S1-1: Next 16's `NextRequest` does NOT expose `request.ip` or `geo`
 * (see `node_modules/next/dist/server/web/spec-extension/request.d.ts`).
 * Client IP is parsed from `x-forwarded-for` (first hop = real client on
 * Vercel) with `x-real-ip` as a fallback for local/dev scenarios. IP is
 * not used in the gate itself — it's recorded on session creation and
 * checked by the rate limiter inside `signIn` server action.
 */
export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname, search } = request.nextUrl;

  const rawToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = await validateSession(rawToken);

  if (pathname === "/login") {
    if (session) {
      return NextResponse.redirect(new URL("/", request.url), 307);
    }
    return NextResponse.next();
  }

  if (session) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", pathname + search);
  const response = NextResponse.redirect(loginUrl, 307);
  // Clear any tampered/expired cookie so the browser does not keep retrying it.
  if (rawToken) {
    const cleared = clearedSessionCookie();
    response.cookies.set(cleared.name, cleared.value, {
      httpOnly: cleared.httpOnly,
      secure: cleared.secure,
      sameSite: cleared.sameSite,
      path: cleared.path,
      expires: cleared.expires,
      maxAge: cleared.maxAge,
    });
  }
  return response;
}

export const config = {
  matcher: [
    /*
     * Exclude:
     *  - /_next/static (build output)
     *  - /_next/image (next/image optimizer)
     *  - /_next/data (RSC payload requests)
     *  - /favicon.ico (browser auto-fetch)
     *  - /api/health (public liveness endpoint, NFR-AVAIL-06)
     */
    "/((?!_next/static|_next/image|_next/data|favicon.ico|api/health|api/cron).*)",
  ],
};

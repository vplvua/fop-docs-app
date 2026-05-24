import { NextResponse } from "next/server";

/**
 * Next.js 16 Proxy (renamed from Middleware). Pass-through for now —
 * real auth gate lands in S1 alongside `lib/auth/getSession()`.
 *
 * The matcher excludes static assets and the public health endpoint so the
 * proxy doesn't run on every image / chunk request once auth is wired up.
 */
export function proxy(): NextResponse {
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/health).*)"],
};

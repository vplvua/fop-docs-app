"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  SESSION_COOKIE_NAME,
  checkRateLimit,
  clearedSessionCookie,
  createSession,
  destroySession,
  parseSafeNext,
  recordFailure,
  recordSuccess,
  sessionCookie,
  verifyPassword,
  type RateLimitResult,
} from "@/lib/auth";
import { logger } from "@/lib/logging";

import type { SignInState } from "./sign-in-state";

const credentialsSchema = z.object({
  email: z.string().min(1, "Введіть email").email("Невірний формат email"),
  password: z.string().min(1, "Введіть пароль"),
  next: z.string().optional(),
});

type Credentials = z.infer<typeof credentialsSchema>;
type CookieStore = Awaited<ReturnType<typeof cookies>>;

async function getClientIp(): Promise<string> {
  const h = await headers();
  const xff = h.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = h.get("x-real-ip");
  if (real) return real.trim();
  return "0.0.0.0";
}

function setSessionCookie(value: string, expires: Date, store: CookieStore) {
  const opts = sessionCookie(value, expires);
  store.set(opts.name, opts.value, {
    httpOnly: opts.httpOnly,
    secure: opts.secure,
    sameSite: opts.sameSite,
    path: opts.path,
    expires: opts.expires,
    maxAge: opts.maxAge,
  });
}

function clearSessionCookie(store: CookieStore) {
  const opts = clearedSessionCookie();
  store.set(opts.name, opts.value, {
    httpOnly: opts.httpOnly,
    secure: opts.secure,
    sameSite: opts.sameSite,
    path: opts.path,
    expires: opts.expires,
    maxAge: opts.maxAge,
  });
}

function fieldErrorsFromZod(issues: z.ZodIssue[]): SignInState {
  const fieldErrors: { email?: string; password?: string } = {};
  for (const issue of issues) {
    const field = issue.path[0];
    if (field === "email" && !fieldErrors.email) fieldErrors.email = issue.message;
    if (field === "password" && !fieldErrors.password) fieldErrors.password = issue.message;
  }
  return { status: "field_error", fieldErrors };
}

function rateLimitedState(rl: Extract<RateLimitResult, { allowed: false }>): SignInState {
  const minutes = Math.max(1, Math.ceil(rl.retryAfterSec / 60));
  return {
    status: "rate_limited",
    message: `Забагато спроб. Спробуйте через ~${minutes} хв.`,
    retryAfterSec: rl.retryAfterSec,
  };
}

async function finalizeSignIn(creds: Credentials, ip: string): Promise<never> {
  const { rawToken, expiresAt } = await createSession({ ip });
  await recordSuccess(ip);
  const store = await cookies();
  setSessionCookie(rawToken, expiresAt, store);
  logger.info({ event: "login.success", ip }, "signed in");
  redirect(parseSafeNext(creds.next));
}

export async function signIn(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") ?? undefined,
  });
  if (!parsed.success) return fieldErrorsFromZod(parsed.error.issues);

  const adminEmail = process.env.ADMIN_EMAIL;
  const adminHash = process.env.ADMIN_PASSWORD_HASH;
  if (!adminEmail || !adminHash) {
    logger.error({ event: "login.config_error" }, "ADMIN_EMAIL or ADMIN_PASSWORD_HASH missing");
    return {
      status: "config_error",
      message: "Сервер не налаштовано. Перевірте змінні середовища.",
    };
  }

  const ip = await getClientIp();
  const rl = await checkRateLimit(ip);
  if (!rl.allowed) {
    logger.warn(
      {
        event: "login.rate_limited",
        ip,
        attempts_in_window: rl.attemptsInWindow,
        retry_after_seconds: rl.retryAfterSec,
      },
      "rate-limited",
    );
    return rateLimitedState(rl);
  }

  const emailMatches = parsed.data.email.toLowerCase() === adminEmail.toLowerCase();
  const passwordOk = emailMatches && (await verifyPassword(parsed.data.password, adminHash));
  if (!passwordOk) {
    await recordFailure(ip);
    logger.warn(
      { event: "login.failed", ip, email_attempted: parsed.data.email },
      "invalid credentials",
    );
    return { status: "invalid_credentials", message: "Невірний email або пароль" };
  }

  return finalizeSignIn(parsed.data, ip);
}

export async function signOut(): Promise<void> {
  const store = await cookies();
  const rawToken = store.get(SESSION_COOKIE_NAME)?.value;
  await destroySession(rawToken);
  clearSessionCookie(store);
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "0.0.0.0";
  logger.info({ event: "logout", ip }, "signed out");
  redirect("/login");
}

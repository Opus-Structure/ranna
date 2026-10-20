"use server";

import { headers } from "next/headers";
import type { z } from "zod";
import { appUrl } from "@/config/brand";
import { redirect } from "@/i18n/navigation";
import { isAppLocale, type AppLocale } from "@/i18n/routing";
import { localizedPath } from "@/lib/auth/paths";
import { serverEnv } from "@/lib/env";
import { clientIp, hashIdentifier, safeNextPath } from "@/lib/http/request";
import { checkLimit } from "@/lib/rate-limit";
import { neonAuth } from "@/lib/auth/server";
import { saveSignupIntent } from "@/lib/auth/session";
import {
  loginSchema,
  magicLinkSchema,
  signupSchema,
  type LoginInput,
  type MagicLinkInput,
  type SignupInput,
} from "@/lib/validation/auth";

/** Error values are i18n keys under `auth.errors` (or `common.errors` for formError). */
export type AuthResult =
  | { ok: true; status: "check-email" | "confirm-email"; email: string }
  | {
      ok: false;
      fieldErrors?: Record<string, string>;
      formError?: "invalidCredentials" | "emailTaken" | "weakPassword" | "rateLimited" | "generic";
      retryAfterSec?: number;
    };

function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}

async function identity(extra?: string): Promise<string> {
  const secret = serverEnv().APP_SECRET;
  const ip = hashIdentifier(clientIp(await headers()), secret);
  return extra ? `${ip}:${hashIdentifier(extra, secret)}` : ip;
}

/** Where an emailed link lands after Neon Auth has verified it (the session is exchanged in middleware). */
function afterLinkUrl(locale: AppLocale): string {
  return `${appUrl()}${localizedPath("/dashboard", locale)}`;
}

/** Better Auth reports failures as { code, message, status }. */
type AuthFailure = { code?: string; message?: string; status?: number } | null | undefined;
const failureCode = (error: AuthFailure) => (error?.code ?? "").toUpperCase();
const isRateLimited = (error: AuthFailure) => error?.status === 429;

function assertLocale(locale: string): AppLocale {
  return isAppLocale(locale) ? locale : "ar";
}

export async function signUpAction(rawLocale: string, input: SignupInput): Promise<AuthResult> {
  const locale = assertLocale(rawLocale);
  const parsed = signupSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrors(parsed.error) };
  const limit = await checkLimit("signup", await identity());
  if (!limit.ok) return { ok: false, formError: "rateLimited", retryAfterSec: limit.retryAfterSec };

  const { email, password, shopName } = parsed.data;
  const { data, error } = await neonAuth().signUp.email({
    email,
    password,
    // Better Auth requires a display name; the shop is what this account is about.
    name: shopName,
  });

  if (error) {
    const code = failureCode(error);
    if (code.includes("ALREADY_EXISTS") || code.includes("ALREADY_USE"))
      return { ok: false, formError: "emailTaken" };
    if (code.includes("PASSWORD")) return { ok: false, fieldErrors: { password: "weakPassword" } };
    if (code.includes("INVALID_EMAIL"))
      return { ok: false, fieldErrors: { email: "emailInvalid" } };
    if (isRateLimited(error)) return { ok: false, formError: "rateLimited", retryAfterSec: 60 };
    console.error("signup failed", { code: error.code, status: error.status });
    return { ok: false, formError: "generic" };
  }

  // The shop is created from this note on the account's first visit (guards.requireMerchant).
  await saveSignupIntent({ email, shopName, locale });

  // With verification required, Neon Auth withholds the session until the address is confirmed.
  if (!data?.token) return { ok: true, status: "confirm-email", email };

  redirect({ href: "/dashboard", locale });
  return { ok: true, status: "confirm-email", email };
}

export async function logInAction(
  rawLocale: string,
  input: LoginInput,
  next?: string,
): Promise<AuthResult> {
  const locale = assertLocale(rawLocale);
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrors(parsed.error) };
  const limit = await checkLimit("login", await identity(parsed.data.email));
  if (!limit.ok) return { ok: false, formError: "rateLimited", retryAfterSec: limit.retryAfterSec };

  const { error } = await neonAuth().signIn.email(parsed.data);
  if (error) {
    if (failureCode(error).includes("NOT_VERIFIED")) {
      return { ok: true, status: "confirm-email", email: parsed.data.email };
    }
    if (isRateLimited(error)) return { ok: false, formError: "rateLimited", retryAfterSec: 60 };
    return { ok: false, formError: "invalidCredentials" };
  }
  // `next` is an unprefixed app path (e.g. /dashboard/menu); next-intl adds the locale.
  const target = safeNextPath(next, "/dashboard");
  redirect({ href: target, locale });
  return { ok: false, formError: "generic" };
}

export async function magicLinkAction(
  rawLocale: string,
  input: MagicLinkInput,
): Promise<AuthResult> {
  const locale = assertLocale(rawLocale);
  const parsed = magicLinkSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrors(parsed.error) };
  const limit = await checkLimit("magicLink", await identity(parsed.data.email));
  if (!limit.ok) return { ok: false, formError: "rateLimited", retryAfterSec: limit.retryAfterSec };

  const { email, shopName } = parsed.data;
  // The account is created when the link is clicked, so the shop name waits in signup_intents.
  if (shopName) await saveSignupIntent({ email, shopName, locale });
  const { error } = await neonAuth().signIn.magicLink({
    email,
    callbackURL: afterLinkUrl(locale),
  });
  if (error && isRateLimited(error)) {
    return { ok: false, formError: "rateLimited", retryAfterSec: 60 };
  }
  if (error) {
    // Most often the Magic Link plugin is not enabled on the Neon Auth branch (see README).
    console.error("magic link failed", { code: error.code, status: error.status });
    return { ok: false, formError: "generic" };
  }
  return { ok: true, status: "check-email", email };
}

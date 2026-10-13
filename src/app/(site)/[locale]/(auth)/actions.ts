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
import { createSupabaseServerClient } from "@/lib/supabase/server";
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

function confirmUrl(locale: AppLocale): string {
  const next = encodeURIComponent(localizedPath("/dashboard", locale));
  return `${appUrl()}/auth/confirm?next=${next}`;
}

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
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: confirmUrl(locale),
      data: { locale, pending_shop_name: shopName },
    },
  });

  if (error) {
    if (error.code === "user_already_exists" || error.code === "email_exists") {
      return { ok: false, formError: "emailTaken" };
    }
    if (error.code === "weak_password")
      return { ok: false, fieldErrors: { password: "weakPassword" } };
    if (error.code === "email_address_invalid")
      return { ok: false, fieldErrors: { email: "emailInvalid" } };
    if (error.code === "over_email_send_rate_limit" || error.status === 429) {
      return { ok: false, formError: "rateLimited", retryAfterSec: 60 };
    }
    console.error("signup failed", { code: error.code, status: error.status });
    return { ok: false, formError: "generic" };
  }

  // With email confirmation on, Supabase hides whether the address already exists.
  if (!data.session) return { ok: true, status: "confirm-email", email };

  // The console creates the shop from `pending_shop_name` on first visit.
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

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    if (error.code === "email_not_confirmed") {
      return { ok: true, status: "confirm-email", email: parsed.data.email };
    }
    if (error.status === 429) return { ok: false, formError: "rateLimited", retryAfterSec: 60 };
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
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      // Only the sign-up page may create accounts; the login page never reveals whether one exists.
      shouldCreateUser: Boolean(shopName),
      emailRedirectTo: confirmUrl(locale),
      data: shopName ? { locale, pending_shop_name: shopName } : undefined,
    },
  });
  if (error && (error.status === 429 || error.code === "over_email_send_rate_limit")) {
    return { ok: false, formError: "rateLimited", retryAfterSec: 60 };
  }
  if (error && error.code !== "otp_disabled" && error.code !== "signup_disabled") {
    console.error("magic link failed", { code: error.code, status: error.status });
  }
  return { ok: true, status: "check-email", email };
}

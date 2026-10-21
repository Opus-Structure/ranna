import "server-only";
import { notFound } from "next/navigation";
import { redirect } from "@/i18n/navigation";
import { isAppLocale, type AppLocale } from "@/i18n/routing";
import {
  getMerchantContext,
  loadMerchantContext,
  type MerchantContext,
} from "@/lib/merchants/context";
import { createMerchantForOwner } from "@/lib/merchants/service";
import { shopNameSchema } from "@/lib/validation/auth";
import { currentAppPath } from "./current-path";
import {
  clearSignupIntent,
  getProfile,
  getSessionUser,
  readSignupIntent,
  type SessionUser,
} from "./session";

function asLocale(locale: string): AppLocale {
  return isAppLocale(locale) ? locale : "ar";
}

/** Signed-in user, or a redirect to login that comes back to the current page. */
export async function requireUser(locale: string): Promise<SessionUser> {
  const user = await getSessionUser();
  if (user) return user;
  const next = await currentAppPath();
  return redirect({ href: { pathname: "/login", query: { next } }, locale: asLocale(locale) });
}

/**
 * The user's shop. A user who signed up (password or email link) left the shop name with their
 * sign-up (a signup_intent keyed by email): the shop is created here on first visit, in state
 * pending_payment. Users with neither a shop nor a pending name go to /start.
 */
export async function requireMerchant(locale: string): Promise<MerchantContext> {
  const user = await requireUser(locale);
  const ctx = await getMerchantContext();
  if (ctx) return ctx;
  const intent = user.email ? await readSignupIntent(user.email) : null;
  const name = shopNameSchema.safeParse(intent?.shopName ?? "");
  if (name.success && user.email) {
    const preferred = isAppLocale(intent?.locale) ? intent.locale : asLocale(locale);
    await createMerchantForOwner({ userId: user.id, name: name.data, locale: preferred });
    await clearSignupIntent(user.email);
    const created = await loadMerchantContext(user);
    if (created) return created;
  }
  return redirect({ href: "/start", locale: asLocale(locale) });
}

/** Owner-only pages: staff land on the order board instead (brief: staff see only orders). */
export async function requireOwner(locale: string): Promise<MerchantContext> {
  const ctx = await requireMerchant(locale);
  if (ctx.role !== "owner") redirect({ href: "/dashboard/orders", locale: asLocale(locale) });
  // New owners hand in their commercial register first; that also starts the free trial.
  // Platform admins run the platform, so they are never asked to verify their own shops.
  if (!ctx.merchant.registerSubmittedAt && !ctx.merchant.isDemo) {
    const profile = await getProfile(ctx.user.id);
    if (!profile?.isPlatformAdmin)
      redirect({ href: "/dashboard/verify", locale: asLocale(locale) });
  }
  return ctx;
}

/** Platform admin pages answer 404 to everyone else, so their existence is not advertised. */
export async function requireAdmin(locale: string): Promise<SessionUser> {
  const user = await requireUser(locale);
  const profile = await getProfile(user.id);
  if (!profile?.isPlatformAdmin) notFound();
  return user;
}

"use server";

import { headers } from "next/headers";
import { appUrl } from "@/config/brand";
import { redirect } from "@/i18n/navigation";
import { isAppLocale, type AppLocale } from "@/i18n/routing";
import { localizedPath } from "@/lib/auth/paths";
import { getSessionUser } from "@/lib/auth/session";
import { serverEnv } from "@/lib/env";
import { clientIp, hashIdentifier } from "@/lib/http/request";
import { acceptInvitation, loadInvitation } from "@/lib/merchants/staff";
import { checkLimit } from "@/lib/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { passwordSchema } from "@/lib/validation/auth";

export type InviteActionResult =
  | { ok: true; status: "confirm-email"; email: string }
  | {
      ok: false;
      error: "invalid" | "wrongAccount" | "weakPassword" | "emailTaken" | "rateLimited" | "generic";
    };

const asLocale = (l: string): AppLocale => (isAppLocale(l) ? l : "ar");

/** Signed-in user with the invited address joins the shop, then lands on the order board. */
export async function acceptInviteAction(
  rawLocale: string,
  token: string,
): Promise<InviteActionResult> {
  const locale = asLocale(rawLocale);
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "invalid" };
  const result = await acceptInvitation(user, token);
  if (!result.ok) return result;
  redirect({ href: "/dashboard/orders", locale });
  return { ok: false, error: "generic" };
}

/**
 * New staff create their account here, for the invited address only. No shop name is stored,
 * so no shop is created for them. The confirmation email brings them back to this page,
 * which proves they own the address before they join.
 */
export async function inviteSignupAction(
  rawLocale: string,
  token: string,
  password: string,
): Promise<InviteActionResult> {
  const locale = asLocale(rawLocale);
  const invitation = await loadInvitation(token);
  if (invitation.state !== "valid") return { ok: false, error: "invalid" };
  if (!passwordSchema.safeParse(password).success) return { ok: false, error: "weakPassword" };
  const ip = hashIdentifier(clientIp(await headers()), serverEnv().APP_SECRET);
  const limit = await checkLimit("signup", ip);
  if (!limit.ok) return { ok: false, error: "rateLimited" };

  const back = localizedPath(`/invite/${token}`, locale);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email: invitation.email,
    password,
    options: {
      emailRedirectTo: `${appUrl()}/auth/confirm?next=${encodeURIComponent(back)}`,
      data: { locale },
    },
  });
  if (error) {
    if (error.code === "user_already_exists" || error.code === "email_exists") {
      return { ok: false, error: "emailTaken" };
    }
    if (error.code === "weak_password") return { ok: false, error: "weakPassword" };
    if (error.status === 429) return { ok: false, error: "rateLimited" };
    console.error("invite signup failed", { code: error.code, status: error.status });
    return { ok: false, error: "generic" };
  }
  if (!data.session) return { ok: true, status: "confirm-email", email: invitation.email };

  // Email confirmation off (local dev): signed in already, join straight away.
  const joined = await acceptInvitation(
    {
      id: data.session.user.id,
      email: data.session.user.email ?? null,
      pendingShopName: null,
      locale,
    },
    token,
  );
  if (!joined.ok) return joined;
  redirect({ href: "/dashboard/orders", locale });
  return { ok: false, error: "generic" };
}

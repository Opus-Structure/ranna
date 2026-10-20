"use server";

import { headers } from "next/headers";
import { redirect } from "@/i18n/navigation";
import { isAppLocale, type AppLocale } from "@/i18n/routing";
import { getSessionUser } from "@/lib/auth/session";
import { serverEnv } from "@/lib/env";
import { clientIp, hashIdentifier } from "@/lib/http/request";
import { acceptInvitation, loadInvitation } from "@/lib/merchants/staff";
import { checkLimit } from "@/lib/rate-limit";
import { neonAuth } from "@/lib/auth/server";
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

  const { data, error } = await neonAuth().signUp.email({
    email: invitation.email,
    password,
    name: invitation.email.split("@")[0] || "Staff",
  });
  if (error) {
    const code = (error.code ?? "").toUpperCase();
    if (code.includes("ALREADY_EXISTS") || code.includes("ALREADY_USE")) {
      return { ok: false, error: "emailTaken" };
    }
    if (code.includes("PASSWORD")) return { ok: false, error: "weakPassword" };
    if (error.status === 429) return { ok: false, error: "rateLimited" };
    console.error("invite signup failed", { code: error.code, status: error.status });
    return { ok: false, error: "generic" };
  }
  // Verification required: no session until they confirm; they come back to this page after.
  if (!data?.token || !data.user)
    return { ok: true, status: "confirm-email", email: invitation.email };

  // No verification step: signed in already, join straight away.
  const joined = await acceptInvitation(
    {
      id: data.user.id,
      email: data.user.email ?? null,
      emailVerified: Boolean(data.user.emailVerified),
    },
    token,
  );
  if (!joined.ok) return joined;
  redirect({ href: "/dashboard/orders", locale });
  return { ok: false, error: "generic" };
}

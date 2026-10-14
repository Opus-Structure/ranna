import "server-only";
import { getProfile, getSessionUser, type SessionUser } from "@/lib/auth/session";
import { getMerchantContext, type MerchantContext } from "@/lib/merchants/context";

/**
 * Server Actions re-check authorization themselves (a page guard does not protect the action
 * endpoint). These return null instead of redirecting, so actions can answer with an error.
 */
export async function ownerAction(): Promise<MerchantContext | null> {
  const ctx = await getMerchantContext();
  return ctx && ctx.role === "owner" ? ctx : null;
}

export async function memberAction(): Promise<MerchantContext | null> {
  return getMerchantContext();
}

export async function adminAction(): Promise<SessionUser | null> {
  const user = await getSessionUser();
  if (!user) return null;
  const profile = await getProfile(user.id);
  return profile?.isPlatformAdmin ? user : null;
}

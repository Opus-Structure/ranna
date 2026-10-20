import "server-only";
import { eq } from "drizzle-orm";
import { cache } from "react";
import { neonAuth } from "@/lib/auth/server";
import { serviceDb, withRls } from "@/lib/db/client";
import { profiles, signupIntents } from "@/lib/db/schema";

export type SessionUser = {
  id: string;
  email: string | null;
  /** False until the address is confirmed (only when verification is switched on in Neon Auth). */
  emailVerified: boolean;
};

/**
 * The signed-in user from the Managed Better Auth session cookie (the SDK validates the signed
 * session cache and refreshes from the auth server when it has expired). Memoised per request.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const { data, error } = await neonAuth().getSession();
  const user = data?.user;
  if (error || !user || typeof user.id !== "string") return null;
  return {
    id: user.id,
    email: typeof user.email === "string" ? user.email.toLowerCase() : null,
    emailVerified: Boolean(user.emailVerified),
  };
});

export type Profile = { fullName: string | null; locale: string; isPlatformAdmin: boolean };

/**
 * The user's profile row. Auth users are created outside this database's control, so the row
 * appears on first use (the language they chose at sign-up, never admin) instead of by trigger.
 */
export const getProfile = cache(async (userId: string): Promise<Profile | null> => {
  const read = () =>
    withRls(userId, (tx) =>
      tx
        .select({
          fullName: profiles.fullName,
          locale: profiles.locale,
          isPlatformAdmin: profiles.isPlatformAdmin,
        })
        .from(profiles)
        .where(eq(profiles.id, userId)),
    );
  const [existing] = await read();
  if (existing) return existing;
  const session = await getSessionUser();
  if (!session || session.id !== userId) return null;
  const intent = session.email ? await readSignupIntent(session.email) : null;
  await serviceDb
    .insert(profiles)
    .values({ id: userId, locale: intent?.locale ?? "ar" })
    .onConflictDoNothing();
  const [created] = await read();
  return created ?? null;
});

export type SignupIntent = { shopName: string | null; locale: string };

/** What this email asked for at sign-up, if anything. */
export async function readSignupIntent(email: string): Promise<SignupIntent | null> {
  const [row] = await serviceDb
    .select({ shopName: signupIntents.shopName, locale: signupIntents.locale })
    .from(signupIntents)
    .where(eq(signupIntents.email, email.toLowerCase()));
  return row ?? null;
}

export async function clearSignupIntent(email: string): Promise<void> {
  await serviceDb.delete(signupIntents).where(eq(signupIntents.email, email.toLowerCase()));
}

/** Remembers the shop name and language a new owner entered (latest sign-up wins). */
export async function saveSignupIntent(input: {
  email: string;
  shopName: string | null;
  locale: string;
}): Promise<void> {
  const email = input.email.toLowerCase();
  await serviceDb
    .insert(signupIntents)
    .values({ email, shopName: input.shopName, locale: input.locale })
    .onConflictDoUpdate({
      target: signupIntents.email,
      set: { shopName: input.shopName, locale: input.locale, createdAt: new Date() },
    });
}

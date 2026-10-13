import "server-only";
import { eq } from "drizzle-orm";
import { cache } from "react";
import { withRls } from "@/lib/db/client";
import { profiles } from "@/lib/db/schema";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type SessionUser = {
  id: string;
  email: string | null;
  /** Shop name captured at sign-up; the console creates the merchant from it on first visit. */
  pendingShopName: string | null;
  locale: string | null;
};

/**
 * The signed-in user, verified (getClaims checks the JWT signature, or asks Auth when the
 * project uses a symmetric secret). Memoised per request.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const sub = claims?.sub;
  if (error || !claims || typeof sub !== "string") return null;
  const meta = (claims.user_metadata ?? {}) as Record<string, unknown>;
  return {
    id: sub,
    email: typeof claims.email === "string" ? claims.email : null,
    pendingShopName: typeof meta.pending_shop_name === "string" ? meta.pending_shop_name : null,
    locale: typeof meta.locale === "string" ? meta.locale : null,
  };
});

export type Profile = { fullName: string | null; locale: string; isPlatformAdmin: boolean };

export const getProfile = cache(async (userId: string): Promise<Profile | null> => {
  const [row] = await withRls(userId, (tx) =>
    tx
      .select({
        fullName: profiles.fullName,
        locale: profiles.locale,
        isPlatformAdmin: profiles.isPlatformAdmin,
      })
      .from(profiles)
      .where(eq(profiles.id, userId)),
  );
  return row ?? null;
});

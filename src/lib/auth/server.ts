import "server-only";
import { createNeonAuth } from "@neondatabase/auth/next/server";
import { serverEnv } from "@/lib/env";

type NeonAuth = ReturnType<typeof createNeonAuth>;
let instance: NeonAuth | undefined;

/**
 * Managed Better Auth (Neon). Created on first use, not at import time, so `next build` and unit
 * tests don't need the auth secrets. Sessions live in cookies set by this app's own /api/auth
 * proxy; SameSite=Lax keeps them across the top-level redirect from an emailed magic link.
 */
export function neonAuth(): NeonAuth {
  if (instance) return instance;
  const env = serverEnv();
  instance = createNeonAuth({
    baseUrl: env.NEON_AUTH_BASE_URL,
    cookies: { secret: env.NEON_AUTH_COOKIE_SECRET, sameSite: "lax" },
  });
  return instance;
}

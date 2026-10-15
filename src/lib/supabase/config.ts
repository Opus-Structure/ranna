/** Public Supabase settings (safe for the browser). */
export function supabasePublicConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set.");
  }
  return { url, anonKey };
}

/**
 * Session cookie flags. Secure in production (HTTPS only) and SameSite=Lax (sent on top-level
 * navigation, not on cross-site posts). Not HttpOnly: the browser client must read the session
 * to authorise Realtime for the order board; the nonce-based CSP is what keeps scripts out (D70).
 */
export const sessionCookieOptions = {
  path: "/",
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
};

import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { sessionCookieOptions, supabasePublicConfig } from "./config";

/** Request-scoped Supabase client acting as the signed-in user (cookie session). */
export async function createSupabaseServerClient() {
  const { url, anonKey } = supabasePublicConfig();
  const cookieStore = await cookies();
  return createServerClient(url, anonKey, {
    cookieOptions: sessionCookieOptions,
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          for (const { name, value, options } of toSet) cookieStore.set(name, value, options);
        } catch {
          // Called from a Server Component: cookies are read-only there. Middleware refreshes them.
        }
      },
    },
  });
}

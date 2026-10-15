import { createServerClient } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";
import { sessionCookieOptions, supabasePublicConfig } from "./config";

type CookieToSet = {
  name: string;
  value: string;
  options?: Parameters<NextResponse["cookies"]["set"]>[2];
};

/**
 * Refreshes the Supabase session before the page renders. Refreshed cookies are written onto the
 * request (so Server Components see them) and returned so the caller can copy them onto the
 * final response. Requests without a Supabase cookie (most customer traffic) skip the work.
 */
export async function refreshSession(request: NextRequest): Promise<CookieToSet[]> {
  if (!request.cookies.getAll().some((c) => c.name.startsWith("sb-"))) return [];
  const { url, anonKey } = supabasePublicConfig();
  const pending: CookieToSet[] = [];
  const supabase = createServerClient(url, anonKey, {
    cookieOptions: sessionCookieOptions,
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        for (const c of toSet) {
          request.cookies.set(c.name, c.value);
          pending.push(c);
        }
      },
    },
  });
  await supabase.auth.getClaims();
  return pending;
}

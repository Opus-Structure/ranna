import { NextResponse, type NextRequest } from "next/server";
import { appUrl } from "@/config/brand";
import { localeFromPath, localizedPath } from "@/lib/auth/paths";
import { safeNextPath } from "@/lib/http/request";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** PKCE code exchange (default Supabase email templates and future OAuth providers). */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));
  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, appUrl()), 303);
  }
  const login = localizedPath("/login", localeFromPath(next));
  return NextResponse.redirect(new URL(`${login}?error=link`, appUrl()), 303);
}

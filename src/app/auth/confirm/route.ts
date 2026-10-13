import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { appUrl } from "@/config/brand";
import { localeFromPath, localizedPath } from "@/lib/auth/paths";
import { safeNextPath } from "@/lib/http/request";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const allowedTypes = new Set<EmailOtpType>([
  "email",
  "signup",
  "magiclink",
  "recovery",
  "invite",
  "email_change",
]);

/**
 * Email links (magic link, sign-up confirmation) land here with a token_hash. Verifying the
 * hash server-side works even when the link is opened on a different device than the request.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const tokenHash = params.get("token_hash");
  const type = params.get("type") as EmailOtpType | null;
  const next = safeNextPath(params.get("next"));

  if (tokenHash && type && allowedTypes.has(type)) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(next, appUrl()), 303);
  }
  const login = localizedPath("/login", localeFromPath(next));
  return NextResponse.redirect(new URL(`${login}?error=link`, appUrl()), 303);
}

import { NextResponse, type NextRequest } from "next/server";
import { appUrl } from "@/config/brand";
import { localizedPath } from "@/lib/auth/paths";
import { isAppLocale } from "@/i18n/routing";
import { isSameOrigin } from "@/lib/http/request";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** POST-only sign-out with an Origin check, so a cross-site link cannot log anyone out. */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request, appUrl())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut({ scope: "local" });
  const form = await request.formData().catch(() => null);
  const locale = form?.get("locale");
  const login = localizedPath("/login", isAppLocale(locale) ? locale : "ar");
  return NextResponse.redirect(new URL(login, appUrl()), 303);
}

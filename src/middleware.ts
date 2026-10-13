import createIntlMiddleware from "next-intl/middleware";
import type { NextRequest } from "next/server";
import { routing } from "@/i18n/routing";
import { buildCsp } from "@/lib/security/csp";
import { refreshSession } from "@/lib/supabase/middleware";

const intl = createIntlMiddleware(routing);

export async function middleware(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const csp = buildCsp({ nonce, dev: process.env.NODE_ENV !== "production" });

  const refreshed = await refreshSession(request);

  request.headers.set("x-nonce", nonce);
  // Layouts cannot read the URL; they need it for `?next=` on login redirects.
  request.headers.set("x-pathname", request.nextUrl.pathname);
  request.headers.set("content-security-policy", csp);
  const response = intl(request);

  for (const { name, value, options } of refreshed) response.cookies.set(name, value, options);
  response.headers.set("content-security-policy", csp);
  return response;
}

export const config = {
  // Pages only: API routes, auth callbacks, Next internals and files with an extension are skipped.
  matcher: ["/((?!api|auth|_next|_vercel|monitoring|.*\\..*).*)"],
};

import createIntlMiddleware from "next-intl/middleware";
import type { NextRequest } from "next/server";
import { routing } from "@/i18n/routing";
import { buildCsp } from "@/lib/security/csp";
import { neonAuth } from "@/lib/auth/server";

const intl = createIntlMiddleware(routing);

export async function middleware(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const csp = buildCsp({ nonce, dev: process.env.NODE_ENV !== "production" });

  // Back from an emailed magic link: Neon Auth appends a one-time verifier that is exchanged for
  // the session cookie here, then the URL is cleaned and the page loads signed in.
  if (request.nextUrl.searchParams.has("neon_auth_session_verifier")) {
    const exchanged = await neonAuth().middleware({ loginUrl: "/login" })(request);
    exchanged.headers.set("content-security-policy", csp);
    return exchanged;
  }

  request.headers.set("x-nonce", nonce);
  // Layouts cannot read the URL; they need it for `?next=` on login redirects.
  request.headers.set("x-pathname", request.nextUrl.pathname);
  request.headers.set("content-security-policy", csp);
  const response = intl(request);

  response.headers.set("content-security-policy", csp);
  return response;
}

export const config = {
  // Pages only: API routes, auth callbacks, Next internals and files with an extension are skipped.
  matcher: ["/((?!api|auth|_next|_vercel|monitoring|.*\\..*).*)"],
};

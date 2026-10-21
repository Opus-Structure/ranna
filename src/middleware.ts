import createIntlMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
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
    const clean = request.nextUrl.clone();
    clean.searchParams.delete("neon_auth_session_verifier");
    const first = clean.pathname.split("/")[1] ?? "";
    const prefix = routing.locales.some((l) => l === first && l !== routing.defaultLocale)
      ? `/${first}`
      : "";
    const loginPath = `${prefix}/login`;

    // Neon's middleware skips the exchange on the login URL itself, and an unmatched /login
    // would then 404 past next-intl. So a stray verifier on the login page is just dropped.
    let exchanged: NextResponse;
    if (clean.pathname === loginPath) {
      exchanged = NextResponse.redirect(clean, 307);
    } else {
      exchanged = await neonAuth().middleware({ loginUrl: "/login" })(request);
      // Exchange failed (e.g. the link was opened in another browser than the one that asked
      // for it): Neon redirects to /login with the verifier still attached. Send them to the
      // localized login page without it.
      const location = exchanged.headers.get("location");
      if (location && new URL(location, request.url).pathname === "/login") {
        clean.pathname = loginPath;
        exchanged = NextResponse.redirect(clean, 307);
      }
    }
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

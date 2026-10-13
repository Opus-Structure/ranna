import { createHmac } from "node:crypto";

/** First hop of x-forwarded-for (set by Vercel), falling back to x-real-ip. */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return headers.get("x-real-ip")?.trim() || "unknown";
}

/** Salted, truncated hash: lets us count by IP or email without storing either. */
export function hashIdentifier(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value.toLowerCase()).digest("base64url").slice(0, 22);
}

/**
 * Only same-site relative paths survive: "/dashboard" yes; "//evil.com", "https://…",
 * "/\evil.com" no. Used for every `next=` redirect parameter.
 */
export function safeNextPath(next: string | null | undefined, fallback = "/dashboard"): string {
  if (!next || typeof next !== "string") return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  if (/[\r\n\t]/.test(next)) return fallback;
  try {
    const url = new URL(next, "http://localhost");
    if (url.origin !== "http://localhost") return fallback;
    return url.pathname + url.search;
  } catch {
    return fallback;
  }
}

/**
 * CSRF guard for JSON route handlers that change state. Server Actions already get Next's
 * built-in Origin check; webhooks authenticate by signature instead.
 */
export function isSameOrigin(request: Request, appUrl: string): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(appUrl).origin;
  } catch {
    return false;
  }
}

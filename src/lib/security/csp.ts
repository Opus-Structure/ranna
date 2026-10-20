/**
 * Nonce-based Content Security Policy (D14). Next.js reads the nonce from the request's CSP
 * header and stamps it on its own scripts; 'strict-dynamic' lets those load their chunks.
 */
export function buildCsp({ nonce, dev }: { nonce: string; dev: boolean }): string {
  const assets = originOf(process.env.NEXT_PUBLIC_ASSETS_URL);
  const realtime = originOf(process.env.NEXT_PUBLIC_REALTIME_URL);
  const realtimeWs = realtime.replace(/^http/, "ws");
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": [
      "'self'",
      `'nonce-${nonce}'`,
      "'strict-dynamic'",
      ...(dev ? ["'unsafe-eval'"] : []),
    ],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:", assets],
    "font-src": ["'self'", "data:"],
    "connect-src": ["'self'", realtime, realtimeWs, ...(dev ? ["ws:"] : [])],
    "media-src": ["'self'", "data:", "blob:"],
    "worker-src": ["'self'"],
    "manifest-src": ["'self'"],
    "frame-ancestors": ["'none'"],
    "form-action": ["'self'"],
    "base-uri": ["'self'"],
    "object-src": ["'none'"],
  };
  const parts = Object.entries(directives).map(([k, v]) => `${k} ${v.filter(Boolean).join(" ")}`);
  if (!dev) parts.push("upgrade-insecure-requests");
  return parts.join("; ");
}

function originOf(url: string | undefined): string {
  if (!url) return "";
  try {
    return new URL(url).origin;
  } catch {
    return "";
  }
}

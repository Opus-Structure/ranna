import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const assetsUrl = new URL(
  process.env.NEXT_PUBLIC_ASSETS_URL ?? "http://127.0.0.1:9000/merchant-assets",
);

/** Static security headers. The CSP is per-request (nonce) and set in middleware. */
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  // Self-hosted (cPanel/Passenger) builds set BUILD_STANDALONE=1; Vercel builds are unaffected.
  output: process.env.BUILD_STANDALONE === "1" ? "standalone" : undefined,
  poweredByHeader: false,
  reactStrictMode: true,
  // Always put <title>/<meta> in the <head> (not streamed into the body): every crawler and
  // link preview sees them, and our metadata resolves fast enough not to delay the first byte.
  htmlLimitedBots: /.*/,
  experimental: {
    // Compressed images (≤ 2 MB) and receipts (≤ 5 MB) pass through Server Actions.
    serverActions: { bodySizeLimit: "6mb" },
  },
  images: {
    remotePatterns: [
      {
        protocol: assetsUrl.protocol.replace(":", "") as "http" | "https",
        hostname: assetsUrl.hostname,
        port: assetsUrl.port,
        pathname: `${assetsUrl.pathname.replace(/\/$/, "")}/**`,
      },
    ],
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);

import type { MetadataRoute } from "next";
import { appUrl } from "@/config/brand";

/** Public marketing pages are crawlable; the console, auth, API and per-order pages are not. */
export default function robots(): MetadataRoute.Robots {
  const disallow = [
    "/api/",
    "/auth/",
    "/o/",
    "/*/o/",
    "/dashboard",
    "/*/dashboard",
    "/*/admin",
    "/*/screen",
  ];
  return {
    rules: [{ userAgent: "*", allow: "/", disallow }],
    sitemap: `${appUrl()}/sitemap.xml`,
    host: appUrl(),
  };
}

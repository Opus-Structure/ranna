import type { MetadataRoute } from "next";
import { appUrl } from "@/config/brand";
import { locales, routing, type AppLocale } from "@/i18n/routing";

const LEGAL = ["terms", "privacy", "cookies", "refunds"] as const;

/** Arabic is the unprefixed default locale, so its home is the bare origin. */
function url(locale: AppLocale, path: string): string {
  const prefix = locale === routing.defaultLocale ? "" : `/${locale}`;
  return `${appUrl()}${prefix}${path}` || appUrl();
}

function entry(
  path: string,
  priority: number,
  changeFrequency: "weekly" | "monthly" | "yearly",
): MetadataRoute.Sitemap {
  const languages = Object.fromEntries(locales.map((l) => [l, url(l, path)]));
  return locales.map((l) => ({
    url: url(l, path),
    lastModified: new Date("2026-10-20"),
    changeFrequency,
    priority,
    alternates: { languages },
  }));
}

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    ...entry("", 1, "weekly"),
    ...entry("/signup", 0.7, "monthly"),
    ...entry("/s/demo", 0.5, "monthly"),
    ...LEGAL.flatMap((doc) => entry(`/legal/${doc}`, 0.3, "yearly")),
  ];
}

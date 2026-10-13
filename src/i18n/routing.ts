import { defineRouting } from "next-intl/routing";

export const locales = ["ar", "fr", "en"] as const;
export type AppLocale = (typeof locales)[number];

export const routing = defineRouting({
  locales,
  defaultLocale: "ar",
  // Arabic (default) has no prefix, so printed QR URLs stay short: /s/<slug>
  localePrefix: "as-needed",
  localeCookie: { name: "NEXT_LOCALE", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" },
});

export const rtlLocales: ReadonlySet<AppLocale> = new Set(["ar"]);

export function dirFor(locale: string): "rtl" | "ltr" {
  return rtlLocales.has(locale as AppLocale) ? "rtl" : "ltr";
}

export function isAppLocale(value: unknown): value is AppLocale {
  return typeof value === "string" && (locales as readonly string[]).includes(value);
}

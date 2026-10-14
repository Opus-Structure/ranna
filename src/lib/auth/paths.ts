import { isAppLocale, routing, type AppLocale } from "@/i18n/routing";

/**
 * Localized path under `localePrefix: "as-needed"` (D11): the default locale has no prefix.
 * ("/dashboard","fr") -> "/fr/dashboard"; ("/dashboard","ar") -> "/dashboard".
 * Pure on purpose: used by emails, webhooks and cron, outside any request.
 */
export function localizedPath(href: string, locale: AppLocale): string {
  const path = href.startsWith("/") ? href : `/${href}`;
  if (locale === routing.defaultLocale) return path;
  return path === "/" ? `/${locale}` : `/${locale}${path}`;
}

/** Locale implied by an already-localized path, e.g. "/fr/dashboard" -> "fr". */
export function localeFromPath(path: string): AppLocale {
  const first = path.split("/")[1];
  return isAppLocale(first) ? first : routing.defaultLocale;
}

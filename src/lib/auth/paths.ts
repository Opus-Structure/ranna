import { getPathname } from "@/i18n/navigation";
import { isAppLocale, routing, type AppLocale } from "@/i18n/routing";

/** Localized path (respects as-needed prefixes): ("/dashboard","fr") -> "/fr/dashboard". */
export function localizedPath(href: string, locale: AppLocale): string {
  return getPathname({ href, locale });
}

/** Locale implied by an already-localized path, e.g. "/fr/dashboard" -> "fr". */
export function localeFromPath(path: string): AppLocale {
  const first = path.split("/")[1];
  return isAppLocale(first) ? first : routing.defaultLocale;
}

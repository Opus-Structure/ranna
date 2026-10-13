import "server-only";
import { setRequestLocale } from "next-intl/server";
import { isAppLocale, routing, type AppLocale } from "./routing";

/** Validates the [locale] param, enables static locale for this request and returns it typed. */
export async function initLocale(params: Promise<{ locale: string }>): Promise<AppLocale> {
  const { locale } = await params;
  const resolved = isAppLocale(locale) ? locale : routing.defaultLocale;
  setRequestLocale(resolved);
  return resolved;
}

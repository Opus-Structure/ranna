import "server-only";
import { createTranslator } from "next-intl";
import { isAppLocale, routing, type AppLocale } from "@/i18n/routing";
import ar from "../../../messages/ar.json";
import en from "../../../messages/en.json";
import fr from "../../../messages/fr.json";

const catalogs = { ar, fr, en } as const;

/**
 * Translator for code that runs outside a request's locale (emails, push notifications,
 * cron jobs): the locale comes from the recipient, not the URL.
 */
export function translatorFor(locale: string | null | undefined) {
  const l: AppLocale = isAppLocale(locale) ? locale : routing.defaultLocale;
  return { locale: l, t: createTranslator({ locale: l, messages: catalogs[l] }) };
}

import type { I18nText } from "@/lib/db/schema/types";

/** The merchant's text in the visitor's language, falling back to the untranslated base. */
export function pickText(base: string, i18n: I18nText | null | undefined, locale: string): string {
  const value = i18n?.[locale as keyof I18nText];
  return value && value.trim() ? value : base;
}

/** Same, for optional texts such as descriptions. */
export function pickOptional(
  base: string | null | undefined,
  i18n: I18nText | null | undefined,
  locale: string,
): string | null {
  const value = i18n?.[locale as keyof I18nText];
  if (value && value.trim()) return value;
  return base ?? null;
}

/**
 * Search-normalised text: lowercase, Latin accents and Arabic diacritics (tashkeel, tatweel)
 * removed, and alef/ya/ta-marbuta variants folded, so "قهوة" finds "قَهْوَة" and "cafe" finds "Café".
 */
export function searchKey(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[ً-ٰٟـ]/g, "")
    .replace(/[آأإ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .toLowerCase()
    .trim();
}

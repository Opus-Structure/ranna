import type { AppLocale } from "./routing";

/**
 * Intl locale tags per UI locale. Arabic uses ar-DZ with Western digits (D10): the everyday
 * convention in Algeria, and it keeps order numbers identical on the board and the phone.
 */
export const intlLocale: Record<AppLocale, string> = {
  ar: "ar-DZ-u-nu-latn",
  fr: "fr-DZ",
  en: "en-GB",
};

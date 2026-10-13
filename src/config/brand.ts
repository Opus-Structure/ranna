/**
 * The single place the product name lives. Rename the product here.
 * Translation catalogs interpolate `{brand}` from these values.
 */
export const brand = {
  name: "Ranna",
  nameAr: "رنّة",
  tagline: {
    ar: "هاتف زبونك هو جرس الطلب",
    fr: "Le téléphone du client devient le bipeur",
    en: "Your customer's phone is the pager",
  },
  supportEmail: "support@example.com",
} as const;

/** Public base URL, used for QR codes and absolute links. */
export function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

/** The product name as written in a given UI language. */
export function brandName(locale: string): string {
  return locale === "ar" ? brand.nameAr : brand.name;
}

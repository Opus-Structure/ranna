import { intlLocale } from "@/i18n/format";
import type { AppLocale } from "@/i18n/routing";

/** ISO 4217 minor-unit exponents for the currencies we expect; anything else defaults to 2. */
const exponent: Record<string, number> = { DZD: 2, MAD: 2, TND: 3, EUR: 2, USD: 2, XOF: 0 };

/** Decimals shown to people. DZD prices are whole dinars in practice (brief: no decimals). */
const displayDecimals: Record<string, number> = { DZD: 0, XOF: 0 };

export function currencyExponent(currency: string): number {
  return exponent[currency.toUpperCase()] ?? 2;
}

export function toMinor(major: number, currency: string): number {
  return Math.round(major * 10 ** currencyExponent(currency));
}

export function toMajor(minor: number, currency: string): number {
  return minor / 10 ** currencyExponent(currency);
}

export function formatMoney(minor: number, currency: string, locale: AppLocale): string {
  const code = currency.toUpperCase();
  const digits = displayDecimals[code] ?? currencyExponent(code);
  return new Intl.NumberFormat(intlLocale[locale], {
    style: "currency",
    currency: code,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(toMajor(minor, code));
}

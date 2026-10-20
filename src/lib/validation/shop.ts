import { z } from "zod";
import { locales } from "@/i18n/routing";
import { SHOP_FONTS } from "@/lib/branding/theme";
import { validateSlug } from "@/lib/slug";
import { shopNameSchema } from "./auth";
import { cleanText } from "./text";

/** Error messages are keys under `shop.errors`. */
export const hexColor = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^#[0-9a-f]{6}$/, { error: "color" });

/** Partial translations: empty strings are dropped, each value cleaned and capped. */
export const i18nText = (max: number, { multiline = false } = {}) =>
  z
    .object({
      ar: z.string().optional(),
      fr: z.string().optional(),
      en: z.string().optional(),
    })
    .transform((v) => {
      const out: Partial<Record<(typeof locales)[number], string>> = {};
      for (const l of locales) {
        const cleaned = cleanText(v[l] ?? "", { multiline });
        if (cleaned) out[l] = cleaned;
      }
      return out;
    })
    .refine((v) => Object.values(v).every((s) => s.length <= max), { error: "tooLong" });

const optionalText = (max: number) =>
  z
    .string()
    .optional()
    .transform((v) => cleanText(v ?? "") || null)
    .refine((v) => v === null || v.length <= max, { error: "tooLong" });

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .superRefine((value, ctx) => {
    const result = validateSlug(value);
    if (!result.ok) ctx.addIssue({ code: "custom", message: `slug_${result.problem}` });
  });

export const localeList = z
  .array(z.enum(locales))
  .min(1, { error: "localesRequired" })
  .transform((v) => Array.from(new Set(v)));

export const shopProfileSchema = z
  .object({
    name: shopNameSchema,
    phone: z
      .string()
      .optional()
      .transform((v) => (v ?? "").trim() || null)
      .refine((v) => v === null || /^\+?[0-9 ()-]{6,20}$/.test(v), { error: "phone" }),
    address: optionalText(160),
    defaultLocale: z.enum(locales),
    locales: localeList,
  })
  .refine((v) => v.locales.includes(v.defaultLocale), {
    error: "defaultLocale",
    path: ["defaultLocale"],
  });

export const brandingSchema = z.object({
  primaryColor: hexColor,
  secondaryColor: hexColor,
  font: z.enum(SHOP_FONTS),
  layout: z.enum(["list", "grid"]),
  welcome: i18nText(160),
});

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, { error: "time" });

export const openingHoursSchema = z
  .array(
    z.object({ day: z.number().int().min(0).max(6), closed: z.boolean(), open: time, close: time }),
  )
  .length(7)
  .refine((days) => new Set(days.map((d) => d.day)).size === 7, { error: "hours" });

export const orderingSettingsSchema = z.object({
  prepTargetMinutes: z.number().int().min(3).max(90),
  askPhone: z.boolean(),
  phoneRetentionDays: z.number().int().min(1).max(90),
  fallbackMessaging: z.boolean(),
  // Optional so a client that omits them leaves the stored values alone.
  kitchenRouting: z.enum(["none", "print", "screen", "both"]).optional(),
  ticketWidthMm: z.union([z.literal(58), z.literal(80)]).optional(),
});

export const DEFAULT_SETTINGS = {
  prepTargetMinutes: 10,
  askPhone: true,
  phoneRetentionDays: 30,
  fallbackMessaging: false,
  kitchenRouting: "none",
  ticketWidthMm: 80,
} as const;

export const DEFAULT_HOURS = Array.from({ length: 7 }, (_, day) => ({
  day,
  closed: false,
  open: "08:00",
  close: "23:00",
}));

export type ShopProfileInput = z.input<typeof shopProfileSchema>;
export type BrandingInput = z.input<typeof brandingSchema>;
export type OrderingSettingsInput = z.input<typeof orderingSettingsSchema>;

/** Currencies and time zones offered for the markets in scope (D10). */
export const CURRENCIES = ["DZD", "MAD", "TND", "EUR"] as const;
export const TIMEZONES = [
  "Africa/Algiers",
  "Africa/Casablanca",
  "Africa/Tunis",
  "Europe/Paris",
] as const;

export const regionalSchema = z.object({
  currency: z.enum(CURRENCIES),
  timezone: z.enum(TIMEZONES),
});

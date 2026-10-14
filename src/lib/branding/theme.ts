import {
  contrastRatio,
  ensureContrast,
  parseHex,
  readableOn,
  toHex,
  type Rgb,
} from "@/lib/color/contrast";
import type { MerchantBranding, ShopLayout } from "@/lib/db/schema/types";

/** Curated faces with Arabic + Latin coverage. Keys are stored in `branding.font`. */
export const SHOP_FONTS = [
  "cairo",
  "alexandria",
  "tajawal",
  "readex",
  "changa",
  "el-messiri",
  "baloo",
  "reem-kufi",
] as const;
export type ShopFont = (typeof SHOP_FONTS)[number];

export const SHOP_FONT_LABELS: Record<ShopFont, string> = {
  cairo: "Cairo",
  alexandria: "Alexandria",
  tajawal: "Tajawal",
  readex: "Readex Pro",
  changa: "Changa",
  "el-messiri": "El Messiri",
  baloo: "Baloo Bhaijaan 2",
  "reem-kufi": "Reem Kufi",
};

export const DEFAULT_BRANDING = {
  primaryColor: "#b14420",
  secondaryColor: "#1f4f8f",
  font: "cairo" as ShopFont,
  layout: "list" as ShopLayout,
};

/** The customer page ground. Brand colour lives in the header, actions and accents. */
export const SHOP_GROUND = "#fbfaf8";

export type ContrastWarning =
  | { kind: "button_text"; color: "primary" | "secondary"; ratio: number }
  | { kind: "on_ground"; color: "primary" | "secondary"; ratio: number };

export type ShopTheme = {
  font: ShopFont;
  layout: ShopLayout;
  /** CSS custom properties applied on the shop's root element. */
  vars: Record<string, string>;
  warnings: ContrastWarning[];
};

function color(value: string | undefined, fallback: string): Rgb {
  return parseHex(value ?? "") ?? parseHex(fallback)!;
}

/**
 * Derives the customer page palette from the merchant's colours with contrast enforced:
 * text on a brand fill is white or ink (whichever reads better), and brand-coloured text on
 * the page ground is darkened until it reaches 4.5:1. Warnings tell the editor when a choice
 * had to be corrected or still falls short, so the merchant can see it.
 */
export function shopTheme(branding: MerchantBranding | null | undefined): ShopTheme {
  const b = branding ?? {};
  const ground = parseHex(SHOP_GROUND)!;
  const primary = color(b.primaryColor, DEFAULT_BRANDING.primaryColor);
  const secondary = color(b.secondaryColor, DEFAULT_BRANDING.secondaryColor);
  const warnings: ContrastWarning[] = [];

  const onPrimary = readableOn(primary);
  const onSecondary = readableOn(secondary);
  if (onPrimary.ratio < 4.5)
    warnings.push({ kind: "button_text", color: "primary", ratio: onPrimary.ratio });
  if (onSecondary.ratio < 4.5)
    warnings.push({ kind: "button_text", color: "secondary", ratio: onSecondary.ratio });

  const primaryOnGround = contrastRatio(primary, ground);
  const secondaryOnGround = contrastRatio(secondary, ground);
  if (primaryOnGround < 3)
    warnings.push({ kind: "on_ground", color: "primary", ratio: primaryOnGround });
  if (secondaryOnGround < 3)
    warnings.push({ kind: "on_ground", color: "secondary", ratio: secondaryOnGround });

  const font = (SHOP_FONTS as readonly string[]).includes(b.font ?? "")
    ? (b.font as ShopFont)
    : DEFAULT_BRANDING.font;
  return {
    font,
    layout: b.layout === "grid" ? "grid" : "list",
    vars: {
      "--shop-ground": SHOP_GROUND,
      "--brand": toHex(primary),
      "--brand-contrast": toHex(onPrimary.color),
      "--brand-ink": toHex(ensureContrast(primary, ground, 4.5)),
      "--brand-2": toHex(secondary),
      "--brand-2-contrast": toHex(onSecondary.color),
      "--brand-2-ink": toHex(ensureContrast(secondary, ground, 4.5)),
    },
    warnings,
  };
}

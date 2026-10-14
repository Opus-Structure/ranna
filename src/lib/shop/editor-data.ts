import "server-only";
import { eq } from "drizzle-orm";
import type { ShopDraft } from "@/components/shop-editor/use-shop-draft";
import { isAppLocale, type AppLocale } from "@/i18n/routing";
import { DEFAULT_BRANDING, SHOP_FONTS, type ShopFont } from "@/lib/branding/theme";
import { withRls } from "@/lib/db/client";
import { merchants } from "@/lib/db/schema";
import { loadMenu, type MenuCategory } from "@/lib/menu/service";
import type { MerchantContext } from "@/lib/merchants/context";
import { DEFAULT_HOURS } from "@/lib/validation/shop";
import type { PublicCategory } from "./public";

/** The owner's full menu in the shape the storefront components render (hidden sections excluded). */
export function toPublicMenu(menu: MenuCategory[]): PublicCategory[] {
  return menu
    .filter((c) => c.isVisible && c.items.length > 0)
    .map((c) => ({
      id: c.id,
      name: c.name,
      nameI18n: c.nameI18n,
      items: c.items.map((i) => ({
        id: i.id,
        name: i.name,
        nameI18n: i.nameI18n,
        description: i.description,
        descriptionI18n: i.descriptionI18n,
        priceMinor: i.priceMinor,
        imagePath: i.imagePath,
        isAvailable: i.isAvailable,
        optionGroups: i.optionGroups.map((g) => ({
          id: g.id,
          name: g.name,
          nameI18n: g.nameI18n,
          minSelect: g.minSelect,
          maxSelect: g.maxSelect,
          options: g.options.map((o) => ({
            id: o.id,
            name: o.name,
            nameI18n: o.nameI18n,
            priceDeltaMinor: o.priceDeltaMinor,
            isAvailable: o.isAvailable,
          })),
        })),
      })),
    }));
}

export async function loadShopEditor(ctx: MerchantContext) {
  const [m] = await withRls(ctx.user.id, (tx) =>
    tx
      .select({
        name: merchants.name,
        slug: merchants.slug,
        phone: merchants.phone,
        address: merchants.address,
        locales: merchants.locales,
        defaultLocale: merchants.defaultLocale,
        branding: merchants.branding,
        settings: merchants.settings,
        isOpen: merchants.isOpen,
        acceptingOrders: merchants.acceptingOrders,
        currency: merchants.currency,
      })
      .from(merchants)
      .where(eq(merchants.id, ctx.merchant.id)),
  );
  if (!m) throw new Error("merchant not found");
  const menu = await loadMenu(ctx.user.id, ctx.merchant.id);
  const shopLocales = m.locales.filter(isAppLocale);
  const font = (SHOP_FONTS as readonly string[]).includes(m.branding.font ?? "")
    ? (m.branding.font as ShopFont)
    : DEFAULT_BRANDING.font;
  const draft: ShopDraft = {
    name: m.name,
    slug: m.slug ?? "",
    phone: m.phone ?? "",
    address: m.address ?? "",
    locales: shopLocales.length ? shopLocales : ["ar"],
    defaultLocale: isAppLocale(m.defaultLocale) ? m.defaultLocale : ("ar" as AppLocale),
    primaryColor: m.branding.primaryColor ?? DEFAULT_BRANDING.primaryColor,
    secondaryColor: m.branding.secondaryColor ?? DEFAULT_BRANDING.secondaryColor,
    font,
    layout: m.branding.layout ?? DEFAULT_BRANDING.layout,
    welcome: m.branding.welcome ?? {},
    logoPath: m.branding.logoPath ?? null,
    coverPath: m.branding.coverPath ?? null,
    hours: m.settings.openingHours?.length === 7 ? m.settings.openingHours : DEFAULT_HOURS,
  };
  return {
    draft,
    menu: toPublicMenu(menu),
    currency: m.currency,
    toggles: { isOpen: m.isOpen, acceptingOrders: m.acceptingOrders },
  };
}

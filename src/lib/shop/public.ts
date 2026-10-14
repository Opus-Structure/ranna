import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { serviceDb } from "@/lib/db/client";
import {
  categories,
  items,
  merchants,
  optionGroups,
  options,
  slugRedirects,
} from "@/lib/db/schema";
import type { I18nText, MerchantBranding, OpeningHoursDay } from "@/lib/db/schema/types";
import { assembleMenu } from "@/lib/menu/service";
import { slugTag, shopTag } from "./cache";

/** Only what a customer may see: no billing, settings internals or member data. */
export type PublicShop = {
  id: string;
  slug: string;
  name: string;
  status: "pending_payment" | "active" | "past_due" | "suspended" | "canceled";
  graceUntil: string | null;
  isOpen: boolean;
  acceptingOrders: boolean;
  currency: string;
  timezone: string;
  defaultLocale: string;
  locales: string[];
  phone: string | null;
  address: string | null;
  branding: MerchantBranding;
  openingHours: OpeningHoursDay[] | undefined;
  askPhone: boolean;
  /** The seeded demo shop: shown with a "demo" note so nobody mistakes it for a real business. */
  isDemo: boolean;
  menu: PublicCategory[];
};

export type PublicOption = {
  id: string;
  name: string;
  nameI18n: I18nText;
  priceDeltaMinor: number;
  isAvailable: boolean;
};
export type PublicGroup = {
  id: string;
  name: string;
  nameI18n: I18nText;
  minSelect: number;
  maxSelect: number;
  options: PublicOption[];
};
export type PublicItem = {
  id: string;
  name: string;
  nameI18n: I18nText;
  description: string | null;
  descriptionI18n: I18nText;
  priceMinor: number;
  imagePath: string | null;
  isAvailable: boolean;
  optionGroups: PublicGroup[];
};
export type PublicCategory = { id: string; name: string; nameI18n: I18nText; items: PublicItem[] };

export type SlugResolution =
  { kind: "shop"; merchantId: string } | { kind: "redirect"; slug: string } | null;

async function resolveSlugUncached(slug: string): Promise<SlugResolution> {
  const [m] = await serviceDb
    .select({ id: merchants.id })
    .from(merchants)
    .where(eq(merchants.slug, slug));
  if (m) return { kind: "shop", merchantId: m.id };
  const [r] = await serviceDb
    .select({ slug: merchants.slug })
    .from(slugRedirects)
    .innerJoin(merchants, eq(merchants.id, slugRedirects.merchantId))
    .where(eq(slugRedirects.oldSlug, slug));
  return r?.slug ? { kind: "redirect", slug: r.slug } : null;
}

async function loadPublicShopUncached(merchantId: string): Promise<PublicShop | null> {
  const [m] = await serviceDb
    .select({
      id: merchants.id,
      slug: merchants.slug,
      name: merchants.name,
      status: merchants.status,
      graceUntil: merchants.graceUntil,
      isOpen: merchants.isOpen,
      acceptingOrders: merchants.acceptingOrders,
      currency: merchants.currency,
      timezone: merchants.timezone,
      defaultLocale: merchants.defaultLocale,
      locales: merchants.locales,
      phone: merchants.phone,
      address: merchants.address,
      branding: merchants.branding,
      settings: merchants.settings,
      isDemo: merchants.isDemo,
    })
    .from(merchants)
    .where(eq(merchants.id, merchantId));
  if (!m?.slug) return null;

  const [cats, its, groups, opts] = await Promise.all([
    serviceDb
      .select()
      .from(categories)
      .where(and(eq(categories.merchantId, merchantId), eq(categories.isVisible, true)))
      .orderBy(asc(categories.sort), asc(categories.createdAt)),
    serviceDb
      .select()
      .from(items)
      .where(eq(items.merchantId, merchantId))
      .orderBy(asc(items.sort), asc(items.createdAt)),
    serviceDb
      .select()
      .from(optionGroups)
      .where(eq(optionGroups.merchantId, merchantId))
      .orderBy(asc(optionGroups.sort)),
    serviceDb
      .select()
      .from(options)
      .where(eq(options.merchantId, merchantId))
      .orderBy(asc(options.sort)),
  ]);

  const menu: PublicCategory[] = assembleMenu(cats, its, groups, opts)
    .filter((c) => c.items.length > 0)
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

  return {
    id: m.id,
    slug: m.slug,
    name: m.name,
    status: m.status,
    graceUntil: m.graceUntil?.toISOString() ?? null,
    isOpen: m.isOpen,
    acceptingOrders: m.acceptingOrders,
    currency: m.currency,
    timezone: m.timezone,
    defaultLocale: m.defaultLocale,
    locales: m.locales,
    phone: m.phone,
    address: m.address,
    branding: m.branding,
    openingHours: m.settings.openingHours,
    askPhone: m.settings.askPhone ?? true,
    isDemo: m.isDemo,
    menu,
  };
}

/**
 * Cached for 60 s and dropped immediately on any menu, branding, slug or account change
 * (tags). Keeps the shop page fast on a cold 4G connection without serving stale menus.
 */
export function resolveSlug(slug: string): Promise<SlugResolution> {
  return unstable_cache(() => resolveSlugUncached(slug), ["shop-slug", slug], {
    tags: [slugTag(slug)],
    revalidate: 60,
  })();
}

export function getPublicShop(merchantId: string): Promise<PublicShop | null> {
  return unstable_cache(() => loadPublicShopUncached(merchantId), ["shop", merchantId], {
    tags: [shopTag(merchantId)],
    revalidate: 60,
  })();
}

export { loadPublicShopUncached };

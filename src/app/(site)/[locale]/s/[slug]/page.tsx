import type { Metadata, Viewport } from "next";
import { getTranslations } from "next-intl/server";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import { ShopFooter } from "@/components/storefront/shop-footer";
import { ShopHeader } from "@/components/storefront/shop-header";
import { ShopMenu } from "@/components/storefront/shop-menu";
import { ShopNotice } from "@/components/storefront/shop-notice";
import { ShopRoot } from "@/components/storefront/shop-root";
import { isAppLocale, type AppLocale } from "@/i18n/routing";
import { initLocale } from "@/i18n/server";
import { localizedPath } from "@/lib/auth/paths";
import { shopTheme } from "@/lib/branding/theme";
import { intlLocale } from "@/i18n/format";
import { pickOptional } from "@/lib/i18n/pick";
import { getPublicShop, resolveSlug, type PublicShop } from "@/lib/shop/public";
import { storefrontStatus } from "@/lib/shop/status";
import { validateSlug } from "@/lib/slug";
import { assetUrl } from "@/lib/storage/public-url";

type Params = Promise<{ locale: string; slug: string }>;
type Search = Promise<{ t?: string }>;

async function loadShop(slug: string): Promise<PublicShop | { redirect: string } | null> {
  const normalized = slug.toLowerCase();
  if (!validateSlug(normalized).ok && normalized !== "demo") return null;
  const resolved = await resolveSlug(normalized);
  if (!resolved) return null;
  if (resolved.kind === "redirect") return { redirect: resolved.slug };
  return getPublicShop(resolved.merchantId);
}

/** Table/counter code from `?t=`: short, plain, shown to staff on the order. */
function tableCode(raw: string | undefined): string | undefined {
  return raw && /^[A-Za-z0-9_-]{1,12}$/.test(raw) ? raw : undefined;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug, locale } = await params;
  const shop = await loadShop(slug);
  if (!shop || "redirect" in shop) return { robots: { index: false } };
  const welcome = pickOptional(null, shop.branding.welcome, locale);
  const image = assetUrl(shop.branding.coverPath) ?? assetUrl(shop.branding.logoPath);
  return {
    title: { absolute: shop.name },
    description: welcome ?? undefined,
    openGraph: {
      title: shop.name,
      description: welcome ?? undefined,
      images: image ? [image] : undefined,
    },
  };
}

export async function generateViewport({ params }: { params: Params }): Promise<Viewport> {
  const { slug } = await params;
  const shop = await loadShop(slug);
  const color =
    shop && !("redirect" in shop) ? shopTheme(shop.branding).vars["--brand"] : "#fbfaf8";
  return { themeColor: color, width: "device-width", initialScale: 1 };
}

export default async function ShopPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}) {
  const locale = await initLocale(params);
  const { slug } = await params;
  const table = tableCode((await searchParams).t);
  const query = table ? `?t=${encodeURIComponent(table)}` : "";
  const t = await getTranslations("storefront");

  const shop = await loadShop(slug);
  if (!shop) notFound();
  // Old links (printed QR codes) follow the shop to its new slug.
  if ("redirect" in shop)
    permanentRedirect(`${localizedPath(`/s/${shop.redirect}`, locale)}${query}`);
  if (slug !== shop.slug) permanentRedirect(`${localizedPath(`/s/${shop.slug}`, locale)}${query}`);
  // Visitors arriving in a language the shop does not offer get its main language.
  if (!shop.locales.includes(locale) && isAppLocale(shop.defaultLocale)) {
    redirect(`${localizedPath(`/s/${shop.slug}`, shop.defaultLocale)}${query}`);
  }

  const now = new Date();
  const status = storefrontStatus(shop, now);
  if (!status.live) {
    return (
      <ShopNotice
        title={t("unavailable.title")}
        body={t("unavailable.body")}
        shopName={shop.name}
      />
    );
  }

  const dayName = (day: number) =>
    new Intl.DateTimeFormat(intlLocale[locale as AppLocale], {
      weekday: "long",
      timeZone: "UTC",
    }).format(new Date(Date.UTC(2026, 0, 4 + day)));
  const statusLabel =
    status.tone === "open"
      ? t("status.open")
      : status.tone === "paused"
        ? t("status.paused")
        : status.next
          ? status.next.today
            ? t("status.opensToday", { time: status.next.time })
            : t("status.opensOn", { day: dayName(status.next.day), time: status.next.time })
          : t("status.closed");

  const theme = shopTheme(shop.branding);
  return (
    <ShopRoot theme={theme} className="min-h-dvh">
      {shop.isDemo ? (
        <p className="bg-[var(--shop-ink)] px-4 py-2 text-center text-xs font-semibold text-white">
          {t("demo")}
        </p>
      ) : null}
      <main id="main">
        <ShopHeader
          name={shop.name}
          logoUrl={assetUrl(shop.branding.logoPath)}
          coverUrl={assetUrl(shop.branding.coverPath)}
          status={{ label: statusLabel, tone: status.tone }}
          welcome={pickOptional(null, shop.branding.welcome, locale)}
        />
        <ShopMenu categories={shop.menu} layout={theme.layout} currency={shop.currency} />
      </main>
      <ShopFooter
        slug={shop.slug}
        locale={locale}
        locales={shop.locales}
        phone={shop.phone}
        address={shop.address}
        table={table}
      />
    </ShopRoot>
  );
}

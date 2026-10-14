"use client";

import { useTranslations } from "next-intl";
import { ShopHeader } from "@/components/storefront/shop-header";
import { ShopMenu } from "@/components/storefront/shop-menu";
import { ShopRoot } from "@/components/storefront/shop-root";
import { shopTheme } from "@/lib/branding/theme";
import type { PublicCategory } from "@/lib/shop/public";
import { assetUrl } from "@/lib/storage/public-url";
import type { ShopDraft } from "./use-shop-draft";

/**
 * The customer page, rendered from the unsaved draft inside a phone frame. Same components
 * as the real page, so what the merchant sees is what customers get.
 */
export function PhonePreview({
  draft,
  menu,
  currency,
  locale,
}: {
  draft: ShopDraft;
  menu: PublicCategory[];
  currency: string;
  locale: string;
}) {
  const t = useTranslations("shopEditor");
  const ts = useTranslations("storefront");
  const theme = shopTheme({
    primaryColor: draft.primaryColor,
    secondaryColor: draft.secondaryColor,
    font: draft.font,
    layout: draft.layout,
  });
  const welcome =
    draft.welcome[locale as keyof ShopDraft["welcome"]] ??
    draft.welcome[draft.defaultLocale] ??
    null;
  return (
    <figure className="flex flex-col items-center gap-3">
      <figcaption className="flex flex-col items-center text-sm text-muted-foreground">
        <span className="font-semibold text-foreground">{t("preview")}</span>
        <span>{t("previewNote")}</span>
      </figcaption>
      <div className="w-[340px] max-w-full rounded-[2.4rem] bg-[#1f1715] p-2.5 shadow-[0_30px_60px_-30px_oklch(0.235_0.018_40/0.55)]">
        <div
          className="relative h-[640px] overflow-y-auto overscroll-contain rounded-[1.9rem] bg-[#fbfaf8]"
          aria-label={t("preview")}
        >
          <ShopRoot theme={theme}>
            <ShopHeader
              name={draft.name || "—"}
              logoUrl={assetUrl(draft.logoPath)}
              coverUrl={assetUrl(draft.coverPath)}
              status={{ label: ts("status.open"), tone: "open" }}
              welcome={welcome?.trim() ? welcome : null}
            />
            <ShopMenu categories={menu} layout={theme.layout} currency={currency} />
          </ShopRoot>
        </div>
      </div>
    </figure>
  );
}

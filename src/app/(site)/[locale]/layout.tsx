import type { Metadata, Viewport } from "next";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { RootDocument } from "@/components/shell/root-document";
import { appUrl } from "@/config/brand";
import { routing } from "@/i18n/routing";
import "../../globals.css";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: hasLocale(routing.locales, locale) ? locale : "ar" });
  return {
    metadataBase: new URL(appUrl()),
    title: { default: t("common.brand"), template: `%s · ${t("common.brand")}` },
    description: t("site.hero.body"),
    icons: {
      icon: [
        { url: "/icons/icon.svg", type: "image/svg+xml" },
        { url: "/favicon.ico", sizes: "48x48" },
      ],
      apple: "/icons/apple-touch-icon.png",
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Chrome: the keyboard resizes the page (so `dvh` and bottom sheets shrink with it).
  interactiveWidget: "resizes-content",
  themeColor: "#FEFCFA",
};

/** Root document for public pages: marketing, auth, customer shop and order status. Always light. */
export default async function SiteRootLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return (
    <RootDocument locale={locale} namespaces={["common"]}>
      {children}
    </RootDocument>
  );
}

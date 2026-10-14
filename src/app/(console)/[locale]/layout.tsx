import type { Metadata, Viewport } from "next";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ThemeProvider } from "next-themes";
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
    robots: { index: false, follow: false },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#70271e" },
    { media: "(prefers-color-scheme: dark)", color: "#421610" },
  ],
};

/**
 * Root document for the merchant console and platform admin. It is a separate root layout from
 * the public site, so the dark theme never leaks onto customer pages (navigating between the
 * two is a full page load).
 */
export default async function ConsoleRootLayout({
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
    <RootDocument
      locale={locale}
      namespaces={["common", "console", "admin", "auth", "billing"]}
      wrap={(node, nonce) => (
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
          storageKey="ranna-console-theme"
          nonce={nonce}
        >
          {node}
        </ThemeProvider>
      )}
    >
      {children}
    </RootDocument>
  );
}

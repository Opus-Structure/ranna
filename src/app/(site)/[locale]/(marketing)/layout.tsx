import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { Logo } from "@/components/brand/brand-mark";
import { LocaleSwitcher } from "@/components/shell/locale-switcher";
import { pickMessages } from "@/components/shell/root-document";
import { Button } from "@/components/ui/button";
import { brandName } from "@/config/brand";
import { Link } from "@/i18n/navigation";

export default async function MarketingLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations("site");
  const messages = await pickMessages(["common", "site"]);
  return (
    <NextIntlClientProvider messages={messages}>
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:start-4 focus:top-4"
      >
        {(await getTranslations("common.a11y"))("skipToContent")}
      </a>
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5 rounded-md text-foreground">
          <Logo duo className="h-7 sm:h-10" />
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2" aria-label={t("nav.label")}>
          {(["how", "pricing", "faq"] as const).map((k) => (
            <Link
              key={k}
              href={{ pathname: "/", hash: k }}
              className="hidden rounded-md px-3 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground md:inline-block"
            >
              {t(`nav.${k}`)}
            </Link>
          ))}
          <LocaleSwitcher />
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link href="/login">{t("nav.login")}</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/signup">{t("nav.start")}</Link>
          </Button>
        </nav>
      </header>
      <div id="main">{children}</div>
      <footer className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-10 text-sm text-muted-foreground sm:px-6">
        <span>
          {t("footer.rights", {
            year: new Date().getFullYear(),
            brand: brandName(await getLocale()),
          })}
        </span>
        <nav aria-label={t("footer.legal")} className="flex flex-wrap gap-x-5 gap-y-2">
          {(["terms", "privacy", "cookies", "refunds"] as const).map((doc) => (
            <Link
              key={doc}
              href={`/legal/${doc}`}
              className="underline-offset-4 hover:text-foreground hover:underline"
            >
              {t(`footer.${doc}`)}
            </Link>
          ))}
        </nav>
      </footer>
    </NextIntlClientProvider>
  );
}

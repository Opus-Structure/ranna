import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { BrandMark, Wordmark } from "@/components/brand/brand-mark";
import { WaitBand } from "@/components/brand/wait-band";
import { LocaleSwitcher } from "@/components/shell/locale-switcher";
import { pickMessages } from "@/components/shell/root-document";
import { brand } from "@/config/brand";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";

/**
 * Auth pages: the clay plate on the start side carries the promise (the screen's single
 * reversed plate); the form sits on the slip ground. On phones the plate shrinks to a header.
 */
export default async function AuthLayout({ children }: { children: ReactNode }) {
  const locale = (await getLocale()) as AppLocale;
  const t = await getTranslations("site.hero");
  const messages = await pickMessages(["common", "auth", "invite"]);
  return (
    <NextIntlClientProvider messages={messages}>
      <div className="grid min-h-dvh lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <aside className="relative flex flex-col justify-between gap-10 bg-clay px-6 py-6 text-clay-foreground lg:px-12 lg:py-12">
          <div className="flex items-center justify-between gap-4">
            <Link href="/" className="flex items-center gap-2.5 rounded-md">
              <BrandMark className="size-8" />
              <Wordmark ar={brand.nameAr} latin={brand.name} />
            </Link>
            <LocaleSwitcher className="text-clay-foreground hover:bg-clay-hover hover:text-clay-foreground lg:hidden" />
          </div>
          <div className="hidden flex-col gap-8 lg:flex">
            <p className="max-w-[18ch] font-display text-4xl leading-tight font-semibold">
              {t("title")}
            </p>
            <div className="max-w-sm [--band-empty:var(--clay-line)] [--band-ink:var(--clay-foreground)] [--band-late:var(--clay-muted)]">
              <WaitBand elapsedMinutes={6} targetMinutes={10} />
            </div>
          </div>
          <p
            className="hidden max-w-[44ch] text-sm leading-relaxed text-clay-muted lg:block"
            lang={locale}
          >
            {brand.tagline[locale]}
          </p>
        </aside>
        <main id="main" className="flex flex-col px-6 py-8 sm:px-10 lg:px-16 lg:py-12">
          <div className="hidden justify-end lg:flex">
            <LocaleSwitcher />
          </div>
          <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-8">
            {children}
          </div>
        </main>
      </div>
    </NextIntlClientProvider>
  );
}

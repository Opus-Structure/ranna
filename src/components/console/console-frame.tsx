import { getLocale, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { BrandMark, Wordmark } from "@/components/brand/brand-mark";
import { brand } from "@/config/brand";
import { Link } from "@/i18n/navigation";
import { ConsoleNav, type NavItem } from "./console-nav";
import { MobileRail } from "./mobile-rail";
import { UserMenu } from "./user-menu";

/**
 * The console shell: a clay rail on the start side (a sheet on phones), the work area on the
 * slip ground. Used by both the merchant dashboard and the platform admin.
 */
export async function ConsoleFrame({
  homeHref,
  identity,
  navLabel,
  nav,
  secondaryNav,
  footerLink,
  user,
  banner,
  children,
}: {
  homeHref: string;
  /** Shop name + live state, or the admin title. */
  identity: ReactNode;
  navLabel: string;
  nav: NavItem[];
  secondaryNav?: NavItem[];
  footerLink?: ReactNode;
  user: { email: string | null; roleLabel: string };
  banner?: ReactNode;
  children: ReactNode;
}) {
  const t = await getTranslations("common.a11y");
  const locale = await getLocale();
  const wordmark = (
    <Link href={homeHref} className="flex items-center gap-2.5 rounded-md text-clay-foreground">
      <BrandMark className="size-7" />
      <Wordmark ar={brand.nameAr} latin={brand.name} />
    </Link>
  );

  const rail = (
    <div className="flex h-full flex-col gap-5 px-3 py-5">
      <div className="px-2">{wordmark}</div>
      <div className="px-2">{identity}</div>
      <div className="mx-2 band-rule text-clay-muted" aria-hidden />
      <ConsoleNav items={nav} label={navLabel} />
      {secondaryNav?.length ? (
        <>
          <div className="mx-2 h-px bg-clay-line" aria-hidden />
          <ConsoleNav items={secondaryNav} label={navLabel} />
        </>
      ) : null}
      <div className="mt-auto flex flex-col gap-2">
        {footerLink}
        <UserMenu email={user.email} roleLabel={user.roleLabel} />
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[260px_minmax(0,1fr)]">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:start-4 focus:top-4"
      >
        {t("skipToContent")}
      </a>
      <form id="signout-form" action="/auth/signout" method="post" hidden>
        <input type="hidden" name="locale" value={locale} />
      </form>
      <aside className="sticky top-0 hidden h-dvh overflow-y-auto bg-clay text-clay-foreground lg:block">
        {rail}
      </aside>
      <MobileRail brand={wordmark} title={navLabel}>
        {rail}
      </MobileRail>
      <div className="flex min-w-0 flex-col">
        {banner}
        <main id="main" className="flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-9">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}

import { ExternalLink } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { AccountBanner } from "@/components/console/account-banner";
import { ConsoleFrame } from "@/components/console/console-frame";
import type { NavItem } from "@/components/console/console-nav";
import { Link } from "@/i18n/navigation";
import { requireMerchant } from "@/lib/auth/guards";
import { getProfile } from "@/lib/auth/session";
import { countNewOrders, loadKitchenConfig } from "@/lib/orders/board";
import { routesToScreen } from "@/lib/orders/kitchen";
import { cn } from "@/lib/utils";
import { initLocale } from "@/i18n/server";

export default async function DashboardLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const locale = await initLocale(params);
  const ctx = await requireMerchant(locale);
  const profile = await getProfile(ctx.user.id);
  const t = await getTranslations("console");
  const { merchant, role } = ctx;
  const [newOrders, kitchen] = await Promise.all([countNewOrders(ctx), loadKitchenConfig(ctx)]);

  const ownerNav: NavItem[] = [
    { href: "/dashboard", label: t("nav.overview"), icon: "overview", exact: true },
    { href: "/dashboard/orders", label: t("nav.orders"), icon: "orders", badge: newOrders },
    { href: "/dashboard/kitchen", label: t("nav.kitchen"), icon: "kitchen" },
    { href: "/dashboard/menu", label: t("nav.menu"), icon: "menu" },
    { href: "/dashboard/shop", label: t("nav.shop"), icon: "shop" },
    { href: "/dashboard/qr", label: t("nav.qr"), icon: "qr" },
    { href: "/dashboard/staff", label: t("nav.staff"), icon: "staff" },
    { href: "/dashboard/billing", label: t("nav.billing"), icon: "billing" },
    { href: "/dashboard/settings", label: t("nav.settings"), icon: "settings" },
  ];
  const nav =
    role === "owner"
      ? ownerNav
      : ownerNav.filter(
          (i) => i.icon === "orders" || (i.icon === "kitchen" && routesToScreen(kitchen.routing)),
        );
  const secondaryNav: NavItem[] = profile?.isPlatformAdmin
    ? [{ href: "/admin", label: t("nav.admin"), icon: "admin" }]
    : [];

  const live = merchant.status === "active" || merchant.status === "past_due";
  const stateLabel = !live
    ? t("shell.closed")
    : !merchant.isOpen
      ? t("shell.closed")
      : merchant.acceptingOrders
        ? `${t("shell.open")} · ${t("shell.accepting")}`
        : `${t("shell.open")} · ${t("shell.paused")}`;
  const stateOn = live && merchant.isOpen && merchant.acceptingOrders;

  const identity = (
    <div className="flex flex-col gap-1">
      <p className="truncate font-display text-ui-lg leading-snug font-semibold">{merchant.name}</p>
      <p className="flex items-center gap-2 text-sm text-clay-muted">
        <span
          aria-hidden
          className={cn(
            "size-2 rotate-45 rounded-[1px]",
            stateOn ? "bg-state-ready" : "bg-clay-muted/60",
          )}
        />
        {stateLabel}
      </p>
    </div>
  );

  const footerLink =
    merchant.slug && live ? (
      <Link
        href={`/s/${merchant.slug}`}
        target="_blank"
        className="flex h-10 items-center gap-2 rounded-lg px-3 text-sm text-clay-muted hover:bg-clay-hover hover:text-clay-foreground"
      >
        <ExternalLink className="size-4" aria-hidden />
        {t("shell.viewShop")}
      </Link>
    ) : null;

  return (
    <ConsoleFrame
      homeHref={role === "owner" ? "/dashboard" : "/dashboard/orders"}
      identity={identity}
      navLabel={t("nav.label")}
      nav={nav}
      secondaryNav={secondaryNav}
      footerLink={footerLink}
      user={{ email: ctx.user.email, roleLabel: t(`shell.role.${role}`) }}
      banner={<AccountBanner merchant={merchant} role={role} />}
    >
      {children}
    </ConsoleFrame>
  );
}

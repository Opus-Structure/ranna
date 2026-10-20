import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { ConsoleFrame } from "@/components/console/console-frame";
import type { NavItem } from "@/components/console/console-nav";
import type { Metadata } from "next";
import { initLocale } from "@/i18n/server";
import { requireAdmin } from "@/lib/auth/guards";
import { getProfile, getSessionUser } from "@/lib/auth/session";

/** Admin titles only for admins: everyone else gets the plain 404 with no hint of the area. */
export async function generateMetadata(): Promise<Metadata> {
  const user = await getSessionUser();
  const profile = user ? await getProfile(user.id) : null;
  if (!profile?.isPlatformAdmin) return {};
  const t = await getTranslations("admin");
  return { title: t("title") };
}

export default async function AdminLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const locale = await initLocale(params);
  const user = await requireAdmin(locale);
  const t = await getTranslations("admin");
  const nav: NavItem[] = [
    { href: "/admin", label: t("nav.merchants"), icon: "merchants", exact: true },
    { href: "/admin/payments", label: t("nav.payments"), icon: "payments" },
    { href: "/admin/plans", label: t("nav.plans"), icon: "plans" },
    { href: "/admin/metrics", label: t("nav.metrics"), icon: "metrics" },
  ];
  return (
    <ConsoleFrame
      homeHref="/admin"
      identity={<p className="font-display text-ui-lg font-semibold">{t("title")}</p>}
      navLabel={t("title")}
      nav={nav}
      secondaryNav={[{ href: "/dashboard", label: t("nav.backToShop"), icon: "shop", exact: true }]}
      user={{ email: user.email, roleLabel: t("title") }}
    >
      {children}
    </ConsoleFrame>
  );
}

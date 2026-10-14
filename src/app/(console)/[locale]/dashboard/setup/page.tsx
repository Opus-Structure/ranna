import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/console/page-header";
import { SetupWizard } from "@/components/shop-editor/setup-wizard";
import { appUrl } from "@/config/brand";
import { redirect } from "@/i18n/navigation";
import { initLocale } from "@/i18n/server";
import { requireOwner } from "@/lib/auth/guards";
import { merchantAccess } from "@/lib/billing/access";
import { loadShopEditor } from "@/lib/shop/editor-data";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("setup");
  return { title: t("title") };
}

/** Opens after activation; an unpaid account goes to billing first. */
export default async function SetupPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await initLocale(params);
  const ctx = await requireOwner(locale);
  if (!merchantAccess(ctx.merchant).canEdit) redirect({ href: "/dashboard/billing", locale });
  const t = await getTranslations("setup");
  const data = await loadShopEditor(ctx);
  return (
    <>
      <PageHeader title={t("title")} />
      <SetupWizard
        initial={data.draft}
        menu={data.menu}
        currency={data.currency}
        origin={appUrl()}
      />
    </>
  );
}
